import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { saveReport, timestampedName } from '../utils/fileUtils.js';
import { getTheme, THEMES } from '../config/themes.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_PROMPT_MODEL || 'gpt-4o';

/**
 * Generate Instagram caption with affiliate CTA.
 *
 * @param {string} themeId - Theme ID
 * @param {object} options
 * @param {string} options.concept - Video concept or description
 * @param {string} [options.affiliateProduct] - Product to promote
 * @param {string} [options.affiliateLink] - Affiliate link description or label
 * @param {string} [options.tone='motivational'] - 'motivational', 'educational', 'story', 'review'
 * @param {boolean} [options.includeHashtags=true] - Include hashtag block
 * @param {string} [options.accountHandle] - Instagram handle for mentions
 * @returns {object} { caption, hashtags, fullCaption }
 */
export async function generateCaption(themeId, options = {}) {
  const theme = getTheme(themeId);
  const {
    concept,
    affiliateProduct = theme.affiliateProducts[0],
    affiliateLink = 'プロフィールリンク',
    tone = 'motivational',
    includeHashtags = true,
    accountHandle = '',
  } = options;

  logger.step(`Generating caption for ${theme.emoji} ${theme.label}...`);

  const toneGuide = {
    motivational: '力強く背中を押す・共感を呼ぶ・行動を促す',
    educational: '具体的な数字やデータ・信頼性重視・学びを提供',
    story:        '一人称の体験談・共感しやすい・ドラマチックな変化',
    review:       '正直な評価・メリット/デメリット・信頼性構築',
  };

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはInstagram/TikTokの自己啓発×アフィリエイトアカウントのキャプション専門家です。
フォロワーを増やしながらアフィリエイト収益を上げるキャプションを作成します。

重要なルール：
- 最初の1-2行が最も重要（「もっと見る」前に表示される部分）
- 絵文字を効果的に使用してスキャンしやすくする
- 商品紹介は自然に（押し売り感を出さない）
- CTAは1つだけ、明確に
- 改行を多用してモバイルで読みやすく`,
      },
      {
        role: 'user',
        content: `テーマ: ${theme.emoji} ${theme.label}
動画コンセプト: ${concept}
紹介商品: ${affiliateProduct}
リンク先: ${affiliateLink}
トーン: ${toneGuide[tone] || tone}

以下のJSON形式でキャプションを生成してください：
{
  "first_line": "最初の1行（最重要・「もっと見る」前）",
  "caption_body": "本文（絵文字付き、改行あり）",
  "affiliate_mention": "商品紹介部分（自然に組み込む）",
  "cta": "CTA一文",
  "hashtags": ["#tag1", "#tag2", ...（20個）"],
  "alt_captions": ["別パターン1の最初の行", "別パターン2の最初の行"]
}`,
      },
    ],
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(response.choices[0].message.content);

  // Assemble full caption
  const captionParts = [
    data.first_line,
    '',
    data.caption_body,
    '',
    data.affiliate_mention,
    '',
    data.cta,
  ];

  if (includeHashtags && data.hashtags?.length) {
    // Instagram best practice: hashtags in first comment or after separator
    captionParts.push('', '・', '', data.hashtags.join(' '));
  }

  const fullCaption = captionParts.join('\n');

  logger.success('Caption generated');

  return {
    firstLine: data.first_line,
    captionBody: data.caption_body,
    affiliateMention: data.affiliate_mention,
    cta: data.cta,
    hashtags: data.hashtags,
    altCaptions: data.alt_captions,
    fullCaption,
  };
}

/**
 * Generate captions for all posts in a content plan.
 *
 * @param {object[]} posts - Array of post objects from content plan
 * @param {object} options
 * @returns {object[]} Posts with captions attached
 */
export async function generateCaptionsForPlan(posts, options = {}) {
  logger.section(`Generating captions for ${posts.length} posts...`);
  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    logger.step(`Caption ${i + 1}/${posts.length}: Day ${post.day} - ${post.theme}`);

    try {
      const caption = await generateCaption(post.theme, {
        concept: post.concept,
        affiliateProduct: post.affiliate_product,
        affiliateLink: options.affiliateLink || 'プロフィールリンク',
        tone: post.type || 'motivational',
        accountHandle: options.accountHandle,
      });

      results.push({ ...post, caption });
    } catch (err) {
      logger.error(`Caption ${i + 1} failed: ${err.message}`);
      results.push({ ...post, caption: null, captionError: err.message });
    }
  }

  // Save full plan with captions
  const report = results.map(p => {
    const theme = THEMES[p.theme];
    return [
      `## Day ${p.day} (${p.date_label}) ${p.post_time} ${theme?.emoji} ${theme?.label}`,
      `**フック:** ${p.hook}`,
      '',
      '### キャプション',
      p.caption?.fullCaption || `エラー: ${p.captionError}`,
      '',
      '---',
    ].join('\n');
  }).join('\n\n');

  const header = `# 投稿キャプション集\n作成日: ${new Date().toLocaleDateString('ja-JP')}\n\n`;
  const reportPath = saveReport(header + report, timestampedName('captions', 'txt'));
  logger.success(`Captions saved: ${reportPath}`);

  return results;
}

/**
 * Generate a reel script (narration/VO text) from a video concept.
 *
 * @param {string} themeId - Theme ID
 * @param {object} concept - Video concept
 * @param {number} [durationSec=60] - Target video duration
 * @returns {object} Script with timed segments
 */
export async function generateReelScript(themeId, concept, durationSec = 60) {
  const theme = getTheme(themeId);

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはTikTok/Instagram Reelsのナレーション台本専門家です。
視聴維持率を最大化する構成で${durationSec}秒の台本を作成します。`,
      },
      {
        role: 'user',
        content: `テーマ: ${theme.emoji} ${theme.label}
コンセプト: ${JSON.stringify(concept)}
尺: ${durationSec}秒

以下のJSON形式で台本を生成してください：
{
  "title": "動画タイトル",
  "script": [
    {
      "start_sec": 0,
      "end_sec": 3,
      "narration": "ナレーションテキスト",
      "visual_cue": "画面指示",
      "emotion": "感情・トーン"
    }
  ],
  "full_narration": "ナレーション全文（続けて読めるテキスト）",
  "key_message": "核心メッセージ（一言）"
}`,
      },
    ],
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}
