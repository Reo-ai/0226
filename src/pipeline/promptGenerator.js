import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_PROMPT_MODEL || 'gpt-4o';

/**
 * Generate image generation prompts for each cut.
 *
 * @param {object} analysis - Full deep analysis result
 * @param {object} originalVersion - User-approved original version concept
 * @returns {Array<{cutIndex: number, prompt: string}>}
 */
export async function generateImagePrompts(analysis, originalVersion) {
  logger.step('Generating image prompts with GPT...');

  const cuts = analysis.structureAnalysis?.structure?.cuts || [{ index: 0 }];
  const vision = analysis.visionAnalysis;

  const systemPrompt = `You are an expert prompt engineer for AI image generation.
Rules:
- Write ONLY the prompt, no explanations or JSON wrapping
- Do NOT include any text/caption/subtitle instructions in the prompt
- Must specify "9:16 vertical composition"
- Generate a NEW original image in the same style as the reference, NOT a copy
- Specify vivid, high-contrast, high-saturation colors
- NO hazy/foggy/misty/dreamy/soft-focus effects - images must be sharp and clear
- Professional finish, high quality`;

  const prompts = [];

  for (const cut of cuts) {
    const cutDesc = cut.description || `Cut ${cut.index + 1}`;

    const userPrompt = `Generate an image prompt for TikTok content based on this analysis.

Original video style: ${vision.visual_style}
Color tone: ${vision.color_tone}
Composition: ${vision.composition}

Original version concept (approved by user):
- New subject: ${originalVersion.subject}
- Setting: ${originalVersion.setting}
- Style to maintain: ${originalVersion.styleToMaintain}

This cut: ${cutDesc} (${cut.start?.toFixed(1) || 0}s - ${cut.end?.toFixed(1) || 'end'}s)

Write ONLY the image generation prompt. No explanation.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 400,
    });

    const prompt = response.choices[0].message.content.trim();
    logger.debug(`Cut ${cut.index} prompt:`, prompt);
    prompts.push({ cutIndex: cut.index || 0, cutDescription: cutDesc, prompt });
  }

  return prompts;
}

/**
 * Generate Sora video prompt (Japanese, with action timeline and dialogue).
 *
 * @param {object} analysis - Full deep analysis result
 * @param {object} cut - Cut segment info
 * @param {object} originalVersion - Approved original version concept
 * @returns {object} { sora_prompt, duration, dialogue }
 */
export async function generateSoraPrompt(analysis, cut, originalVersion) {
  logger.step(`Generating Sora prompt for cut ${cut.index || 0}...`);

  const duration = Math.round(cut.duration || 10);
  const audioText = analysis.audioAnalysis?.text || '';
  const cutDesc = cut.description || 'メインシーン';

  const systemPrompt = `あなたはSora動画生成プロンプトの専門家です。
以下の構成でプロンプトを生成してください：
1. キャラクターの外見描写
2. 背景・環境の描写
3. アクションを時系列順に記述（最初は...次に...その後...最後に...）
4. 表情・身振りの補足
5. 照明、縦型9:16、秒数
6. セリフ（必ず一番最後に「セリフ：「〇〇」」の形式で書く）

重要なルール：
- 静止画の説明ではなく、動き・アニメーション・カメラワークを記述する
- セリフは元動画を参考にした似たテーマのオリジナル内容（コピー不可）
- JSONのみ出力（{"sora_prompt": "...", "duration": N, "dialogue": "..."}）`;

  const userPrompt = `元動画の音声テキスト：
${audioText}

このカットの内容：${cutDesc}
カット尺：${duration}秒

承認済みオリジナルバージョン：
- 題材: ${originalVersion.subject}
- 設定: ${originalVersion.setting}
- キャラ: ${originalVersion.character || '未設定'}
- スタイル: ${originalVersion.styleToMaintain}

上記を参考に、${duration}秒の縦型TikTok動画用Soraプロンプトを生成してください。
JSONのみ出力。`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate original version proposal (rule 4.5).
 * Returns formatted proposal text for user confirmation.
 *
 * @param {object} analysis - Full deep analysis result
 * @returns {object} { proposalText, concept }
 */
export async function generateOriginalVersionProposal(analysis) {
  logger.step('Generating original version proposal...');

  const vision = analysis.visionAnalysis;
  const structure = analysis.structureAnalysis;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: `元動画を分析し、オリジナルバージョンの提案を生成してください。

元動画の分析：
- テーマ: ${structure?.theme}
- 被写体: ${JSON.stringify(vision?.subjects)}
- スタイル: ${vision?.visual_style}
- カット数: ${structure?.structure?.total_cuts}
- ペース: ${structure?.structure?.pacing}
- 音声テキスト: ${analysis.audioAnalysis?.text?.slice(0, 200)}

以下のJSON形式で返してください：
{
  "originalContent": "元動画の内容要約（1行）",
  "proposal": {
    "subject": "新しい題材（元の題材を変えたもの）",
    "setting": "新しい設定・ロケーション",
    "character": "キャラクター設定",
    "styleToMaintain": "維持するスタイル・色調・雰囲気",
    "cutStructure": "カット構成の説明",
    "reasoning": "変更理由の説明"
  }
}`,
      },
    ],
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(response.choices[0].message.content);
  const p = data.proposal;

  const proposalText = `
【トレース元】${data.originalContent}
【変更提案】
  - 題材: ${vision?.subjects?.join('、')} → ${p.subject}（${p.reasoning}）
  - キャラ: → ${p.character}
  - 設定: → ${p.setting}
  - スタイル: ${p.styleToMaintain}（維持）
  - カット構成: ${p.cutStructure}
【この方向でいいですか？】(y/n または修正内容を入力)`;

  return { proposalText, concept: p };
}

/**
 * Generate batch image prompts from a prompts JSON file.
 * Expected file format: [{ "prompt": "...", "filename": "..." }, ...]
 */
export async function enhancePromptForImage(rawPrompt) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `Enhance this image generation prompt for TikTok content.
Rules:
- Write ONLY the enhanced prompt, no explanations
- Must include "9:16 vertical composition"
- No text/captions/subtitles in the image
- Vivid colors, high contrast, sharp and clear (no blur/haze/fog)
- Professional quality`,
      },
      { role: 'user', content: rawPrompt },
    ],
    max_tokens: 400,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Translate Japanese Sora prompt to English for Runway/other services.
 */
export async function translateToEnglish(japanesePrompt) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Translate the following Japanese video generation prompt to English. Keep technical terms and formatting. Output only the translation.',
      },
      { role: 'user', content: japanesePrompt },
    ],
    max_tokens: 600,
  });

  return response.choices[0].message.content.trim();
}
