import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { saveReport, timestampedName } from '../utils/fileUtils.js';
import { THEMES, THEME_IDS, WEEKLY_SCHEDULE, getTheme } from '../config/themes.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_PROMPT_MODEL || 'gpt-4o';

/**
 * Generate a weekly or monthly content plan.
 *
 * @param {object} options
 * @param {string[]} [options.themes] - Theme IDs to include (default: all)
 * @param {number} [options.weeks=1] - Number of weeks to plan
 * @param {string} [options.accountHandle] - Instagram handle
 * @param {string[]} [options.affiliateLinks] - Affiliate link descriptions
 * @returns {object} Content plan
 */
export async function generateContentPlan(options = {}) {
  const {
    themes = THEME_IDS,
    weeks = 1,
    accountHandle = 'your_account',
    affiliateLinks = [],
  } = options;

  logger.section('CONTENT STRATEGY PLANNING');

  const selectedThemes = themes.map(id => THEMES[id]).filter(Boolean);
  const totalDays = weeks * 7;

  const themeContext = selectedThemes.map(t =>
    `- ${t.emoji} ${t.label}: hooks=${t.hooks.slice(0, 2).join(' / ')}, products=${t.affiliateProducts.slice(0, 3).join(', ')}`
  ).join('\n');

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはInstagram/TikTok自己啓発アカウントの戦略コンサルタントです。
アフィリエイト収益を最大化しながらフォロワーを増やすコンテンツ計画を立案します。`,
      },
      {
        role: 'user',
        content: `以下の自己啓発アカウント向けに${totalDays}日間のコンテンツカレンダーを作成してください。

アカウント: @${accountHandle}
テーマカテゴリ:
${themeContext}
${affiliateLinks.length ? `\nアフィリエイトリンク:\n${affiliateLinks.join('\n')}` : ''}

各投稿に以下を含めてください：
1. 投稿日・時刻
2. テーマカテゴリ
3. 動画コンセプト（フック文含む）
4. アフィリエイト商品（自然に紹介できるもの）
5. 参考にすべきTikTokトレンドスタイル
6. 推奨ハッシュタグ（10個）

以下のJSON形式で返してください：
{
  "plan": [
    {
      "day": 1,
      "date_label": "月曜日",
      "post_time": "07:00",
      "theme": "fitness",
      "concept": "動画コンセプト",
      "hook": "冒頭フック文（3秒で引き込む）",
      "affiliate_product": "紹介する商品",
      "affiliate_angle": "自然な紹介方法",
      "video_style": "映像スタイル（ミニマル、シネマティック等）",
      "hashtags": ["#tag1", "#tag2"],
      "notes": "制作メモ"
    }
  ],
  "strategy_notes": "全体戦略メモ",
  "growth_tips": ["成長のためのヒント"]
}`,
      },
    ],
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const plan = JSON.parse(response.choices[0].message.content);

  // Format as readable report
  const report = formatContentPlan(plan, accountHandle, weeks);
  const reportName = timestampedName('content_plan', 'txt');
  const reportPath = saveReport(report, reportName);
  logger.success(`Content plan saved: ${reportPath}`);

  // Also save JSON
  const jsonPath = saveReport(JSON.stringify(plan, null, 2), timestampedName('content_plan', 'json'));

  console.log('\n' + report);
  return { plan, reportPath, jsonPath };
}

function formatContentPlan(planData, handle, weeks) {
  const lines = [
    `# @${handle} コンテンツカレンダー（${weeks}週間プラン）`,
    `作成日: ${new Date().toLocaleDateString('ja-JP')}`,
    '',
    '## 全体戦略',
    planData.strategy_notes || '',
    '',
    '## 成長のヒント',
    ...(planData.growth_tips || []).map(t => `- ${t}`),
    '',
    '---',
    '',
    '## 投稿スケジュール',
  ];

  for (const post of planData.plan || []) {
    const theme = THEMES[post.theme];
    lines.push('');
    lines.push(`### Day ${post.day} (${post.date_label}) ${post.post_time} ${theme?.emoji || ''} ${theme?.label || post.theme}`);
    lines.push(`**フック:** ${post.hook}`);
    lines.push(`**コンセプト:** ${post.concept}`);
    lines.push(`**アフィリエイト:** ${post.affiliate_product} → ${post.affiliate_angle}`);
    lines.push(`**映像スタイル:** ${post.video_style}`);
    lines.push(`**ハッシュタグ:** ${(post.hashtags || []).join(' ')}`);
    if (post.notes) lines.push(`**メモ:** ${post.notes}`);
  }

  return lines.join('\n');
}

/**
 * Generate a video concept based on a specific theme and optional reference.
 *
 * @param {string} themeId - Theme ID from THEMES
 * @param {object} options
 * @param {string} [options.hookType='educational'] - 'educational', 'hook', 'story', 'review'
 * @param {string} [options.affiliateProduct] - Specific product to feature
 * @returns {object} Video concept
 */
export async function generateVideoConcept(themeId, options = {}) {
  const theme = getTheme(themeId);
  const { hookType = 'educational', affiliateProduct } = options;

  const product = affiliateProduct || theme.affiliateProducts[0];

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはTikTok/Instagram Reelsのバイラルコンテンツ専門家です。
自己啓発×アフィリエイトで収益化するショート動画のコンセプトを考えます。`,
      },
      {
        role: 'user',
        content: `テーマ: ${theme.emoji} ${theme.label}
動画タイプ: ${hookType}
紹介商品: ${product}

以下のJSON形式でコンセプトを生成してください：
{
  "title": "動画タイトル（30文字以内）",
  "hook": "冒頭0-3秒のフック（視聴者を引き込む一言）",
  "structure": [
    {"second": "0-3", "content": "フック"},
    {"second": "3-15", "content": "本題前半"},
    {"second": "15-30", "content": "本題後半"},
    {"second": "30-45", "content": "アフィリエイト自然紹介"},
    {"second": "45-60", "content": "CTA"}
  ],
  "narration_tone": "ナレーションのトーン",
  "visual_concept": "映像イメージの説明",
  "affiliate_integration": "商品を自然に組み込む方法",
  "expected_engagement": "期待できるエンゲージメント理由"
}`,
      },
    ],
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate image prompt specifically for self-improvement TikTok/Instagram content.
 *
 * @param {string} themeId - Theme ID
 * @param {object} concept - Video concept
 * @param {number} [cutIndex=0] - Cut index for multi-cut videos
 * @returns {string} Image generation prompt
 */
export async function generateSelfImprovementImagePrompt(themeId, concept, cutIndex = 0) {
  const theme = getTheme(themeId);

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert prompt engineer for AI image generation specialized in self-improvement content.
Rules:
- Write ONLY the image generation prompt, no explanations
- Must specify "9:16 vertical composition"
- No text, captions, watermarks, or overlays
- Vivid, high-contrast, high-saturation colors - NO hazy/foggy/soft-focus
- Professional cinematic quality
- Make it visually compelling for TikTok/Instagram Reels thumbnail`,
      },
      {
        role: 'user',
        content: `Create an image generation prompt for this self-improvement content:

Theme: ${theme.label}
Visual Style: ${theme.visualStyle}
Color Tone: ${theme.colorTone}
Subjects: ${theme.subjects.join(', ')}
Video Concept: ${concept.visual_concept || concept.concept || ''}
Cut ${cutIndex + 1}: ${concept.structure?.[cutIndex]?.content || 'Main scene'}

Write ONLY the prompt. No explanation.`,
      },
    ],
    max_tokens: 400,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Generate Sora video prompt for self-improvement content.
 *
 * @param {string} themeId - Theme ID
 * @param {object} concept - Video concept
 * @param {object} cut - Cut segment info
 * @returns {object} { sora_prompt, duration, dialogue }
 */
export async function generateSelfImprovementVideoPrompt(themeId, concept, cut) {
  const theme = getTheme(themeId);
  const duration = Math.round(cut.duration || 15);

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはSora動画生成プロンプトの専門家です。自己啓発TikTok/Instagram Reels向けの動画プロンプトを生成します。

構成順序（必ず守る）：
1. キャラクターの外見描写
2. 背景・環境の描写
3. アクションを時系列順（最初は...次に...その後...最後に...）
4. 表情・身振りの補足
5. 照明、縦型9:16、秒数
6. セリフ（必ず最後に「セリフ：「〇〇」」形式）

ルール：
- 静止画の説明ではなく動き・アニメーション・カメラワークを記述
- セリフはフック力のある自己啓発メッセージ（オリジナル）
- JSONのみ出力`,
      },
      {
        role: 'user',
        content: `テーマ: ${theme.emoji} ${theme.label}
動画スタイル: ${theme.visualStyle}
色調: ${theme.colorTone}
フック: ${concept.hook}
このカットの内容: ${cut.description || concept.structure?.[0]?.content || 'メインシーン'}
尺: ${duration}秒
アフィリエイト商品: ${concept.affiliate_integration || ''}

JSON形式: {"sora_prompt": "...", "duration": ${duration}, "dialogue": "セリフのみ"}`,
      },
    ],
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}
