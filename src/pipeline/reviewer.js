import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { saveReport, timestampedName } from '../utils/fileUtils.js';
import { downloadVideo, extractFrames, imageToBase64 } from '../tiktok/downloader.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_PROMPT_MODEL || 'gpt-4o';

/**
 * Review generated video(s) against a reference video.
 *
 * @param {string} referenceSource - TikTok URL or local file path
 * @param {string[]} generatedPaths - Paths to generated video files
 * @returns {object[]} Review results
 */
export async function reviewVideos(referenceSource, generatedPaths) {
  logger.section('VIDEO REVIEW');

  // Get reference frames
  let refVideoPath = referenceSource;
  if (referenceSource.startsWith('http')) {
    logger.step('Downloading reference video...');
    refVideoPath = await downloadVideo(referenceSource);
  }

  logger.step('Extracting reference frames...');
  const refFrames = await extractFrames(refVideoPath, 2.0);
  const refSampleFrames = sampleFrames(refFrames, 4);

  const results = [];

  for (const genPath of generatedPaths) {
    logger.section(`Reviewing: ${path.basename(genPath)}`);

    if (!fs.existsSync(genPath)) {
      logger.error(`Generated video not found: ${genPath}`);
      results.push({ path: genPath, error: 'File not found' });
      continue;
    }

    // Extract frames from generated video
    const genFrames = await extractFrames(genPath, 2.0);
    const genSampleFrames = sampleFrames(genFrames, 4);

    // Build vision comparison content
    const content = [
      { type: 'text', text: '【参考動画のフレーム（左側）】' },
      ...refSampleFrames.map(fp => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageToBase64(fp)}`, detail: 'high' },
      })),
      { type: 'text', text: '【生成動画のフレーム（右側）】' },
      ...genSampleFrames.map(fp => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageToBase64(fp)}`, detail: 'high' },
      })),
      {
        type: 'text',
        text: `参考動画と生成動画のフレームを比較して自己採点レポートを作成してください。

重要な注意：
- 題材・被写体・キャラクターの違いは意図的な変更なので減点対象外
- 校閲対象は以下のみ：スタイル、構図・構成、動き・アニメーション、雰囲気・色調

以下のJSON形式で返してください：
{
  "matching_points": ["合っている点を列挙"],
  "differences": ["違いや改善が必要な点を列挙"],
  "scores": {
    "style_reproduction": 0,
    "composition": 0,
    "motion_animation": 0,
    "atmosphere_color": 0,
    "total": 0
  },
  "improvements": ["次回リトライ時の改善案"],
  "overall_comment": "総合コメント"
}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content }],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const reviewData = JSON.parse(response.choices[0].message.content);

    // Format report
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const report = formatReport(now, referenceSource, genPath, reviewData);

    // Save report
    const reportName = timestampedName(`review_${path.basename(genPath, '.mp4')}`, 'txt');
    const reportPath = saveReport(report, reportName);
    logger.success(`Review report saved: ${reportPath}`);

    // Print to console
    console.log('\n' + report);

    results.push({ path: genPath, reportPath, review: reviewData });
  }

  return results;
}

function sampleFrames(frames, count) {
  if (frames.length <= count) return frames;
  const step = Math.floor(frames.length / count);
  return Array.from({ length: count }, (_, i) => frames[i * step]);
}

function formatReport(datetime, refSource, genPath, data) {
  const s = data.scores;
  return `# 自己採点レポート
日時: ${datetime}
参考動画: ${refSource}
生成動画: ${genPath}

## 合っている点（トレース成功）
${data.matching_points.map(p => `- ${p}`).join('\n')}

## 違う点（トレースできていない / 改善点）
${data.differences.map(p => `- ${p}`).join('\n')}

## 総合スコア: ${s.total} / 100
- スタイル再現度:       ${s.style_reproduction} / 25
- 構図・構成:           ${s.composition} / 25
- 動き・アニメーション: ${s.motion_animation} / 25
- 雰囲気・色調:         ${s.atmosphere_color} / 25

## 総合コメント
${data.overall_comment}

## 改善案
${data.improvements.map(p => `- ${p}`).join('\n')}
`;
}
