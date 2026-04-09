import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { saveReport, timestampedName } from '../utils/fileUtils.js';
import { getTheme } from '../config/themes.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_PROMPT_MODEL || 'gpt-4o';

/**
 * Generate a Vrew-ready script from a video concept.
 *
 * Vrewの使い方:
 * 1. Vrewを開く → 「新しいプロジェクト」→「テキストから動画を作成」
 * 2. このスクリプトをVrewのテキストエディタに貼り付け
 * 3. AI音声（日本語）を選択してナレーション生成
 * 4. 生成された動画をエクスポート
 *
 * @param {string} themeId - Theme ID
 * @param {object} concept - Video concept
 * @param {object} options
 * @param {number} [options.durationSec=60] - Target duration
 * @param {string} [options.voiceStyle='friendly'] - 'friendly', 'energetic', 'calm', 'professional'
 * @returns {object} { script, vrewText, srtSubtitles }
 */
export async function generateVrewScript(themeId, concept, options = {}) {
  const theme = getTheme(themeId);
  const { durationSec = 60, voiceStyle = 'friendly' } = options;

  logger.step(`Generating Vrew script (${durationSec}s, ${voiceStyle} voice)...`);

  const voiceGuide = {
    friendly:     '親しみやすく・明るく・テンポよく',
    energetic:    '力強く・エネルギッシュ・テンポ速め',
    calm:         '落ち着いた・信頼感・ゆっくり丁寧に',
    professional: 'プロフェッショナル・客観的・説得力ある',
  };

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたはTikTok/Instagram Reels向けナレーション台本の専門家です。
Vrewで読み込んでAI音声を生成するための台本を作成します。
話すスピードの目安：日本語は1分間で約300〜350文字。`,
      },
      {
        role: 'user',
        content: `テーマ: ${theme.emoji} ${theme.label}
コンセプト: ${JSON.stringify(concept, null, 2)}
尺: ${durationSec}秒（約${Math.round(durationSec * 5.5)}文字）
ボイススタイル: ${voiceGuide[voiceStyle] || voiceStyle}
アフィリエイト商品: ${concept.affiliate_integration || theme.affiliateProducts[0]}

以下のJSON形式で台本を生成してください：
{
  "title": "動画タイトル",
  "script_segments": [
    {
      "id": 1,
      "time_sec": 0,
      "duration_sec": 3,
      "text": "ナレーションテキスト",
      "note": "演出メモ（Vrewには貼らない）"
    }
  ],
  "full_script": "ナレーション全文（Vrewに貼るテキスト）",
  "char_count": 文字数,
  "estimated_duration_sec": 推定秒数
}`,
      },
    ],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(response.choices[0].message.content);

  // Generate SRT subtitle file from segments
  const srt = generateSRT(data.script_segments || []);

  // Generate Remotion-compatible subtitle props
  const remotionSubtitles = generateRemotionSubtitles(data.script_segments || [], 30);

  // Save Vrew script file
  const vrewContent = [
    `# ${data.title}`,
    `# テーマ: ${theme.emoji} ${theme.label}`,
    `# 推定尺: ${data.estimated_duration_sec}秒`,
    `# 文字数: ${data.char_count}文字`,
    '',
    '--- Vrewに貼るテキスト（ここから） ---',
    '',
    data.full_script,
    '',
    '--- ここまで ---',
    '',
    '=== 演出メモ ===',
    ...(data.script_segments || []).map(s =>
      `[${s.time_sec}s-${s.time_sec + s.duration_sec}s] ${s.text}\n  → ${s.note || ''}`
    ),
  ].join('\n');

  const scriptPath = saveReport(vrewContent, timestampedName(`vrew_script_${themeId}`, 'txt'));
  const srtPath = saveReport(srt, timestampedName(`subtitles_${themeId}`, 'srt'));

  logger.success(`Vrew script saved: ${scriptPath}`);
  logger.success(`SRT subtitles saved: ${srtPath}`);

  // Print usage instructions
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Vrewの使い方                                            ║
╠══════════════════════════════════════════════════════════╣
║  1. Vrew を開く                                          ║
║  2. 「新しいプロジェクト」→「テキストから動画を作成」      ║
║  3. 以下のスクリプトを貼り付け:                           ║
║     ${scriptPath.slice(-50).padEnd(50)}║
║  4. AI音声（日本語）を選択 → 生成                        ║
║  5. 生成された動画に output/images/ の画像を背景として設定 ║
║  6. MP4でエクスポート                                    ║
╚══════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════╗
║  Remotion字幕データも生成済み                            ║
║  src/video/remotionRenderer.js で字幕オーバーレイ可能    ║
╚══════════════════════════════════════════════════════════╝
`);

  return { script: data, vrewText: data.full_script, srtSubtitles: srt, remotionSubtitles, scriptPath, srtPath };
}

function generateSRT(segments) {
  return segments.map((seg, i) => {
    const start = formatSRTTime(seg.time_sec || 0);
    const end = formatSRTTime((seg.time_sec || 0) + (seg.duration_sec || 5));
    return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
  }).join('\n');
}

function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function generateRemotionSubtitles(segments, fps) {
  return segments.map(seg => ({
    text: seg.text,
    startFrame: Math.round((seg.time_sec || 0) * fps),
    endFrame: Math.round(((seg.time_sec || 0) + (seg.duration_sec || 5)) * fps),
  }));
}
