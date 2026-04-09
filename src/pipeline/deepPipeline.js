import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { saveReport, timestampedName, DIRS } from '../utils/fileUtils.js';
import { deepAnalyze } from './deepAnalyzer.js';
import {
  generateImagePrompts,
  generateSoraPrompt,
  generateOriginalVersionProposal,
} from './promptGenerator.js';
import { generateImages } from '../gemini/imageGenerator.js';
import { generateVideo as generateSoraVideo } from '../video/soraGenerator.js';
import {
  generateVideoFromImage as generateKlingVideo,
} from '../video/klingGenerator.js';
import { imageToBase64 } from '../tiktok/downloader.js';

/**
 * Prompt user for confirmation/input via readline.
 */
async function promptUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question + ' ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Full deep pipeline: analyze → propose → generate images → generate videos.
 *
 * @param {string} url - TikTok video URL
 * @param {object} options
 * @param {number} [options.count=1] - Variation count (overridden by cut count)
 * @param {boolean} [options.skipVideo=false] - Skip video generation
 * @param {boolean} [options.referenceFrames=false] - Use reference frames (auto when cuts detected)
 * @param {string} [options.imageModel='gemini'] - 'gemini' or 'imagen'
 * @param {string} [options.service='sora'] - 'sora', 'kling', or 'both'
 */
export async function deepPipeline(url, options = {}) {
  const {
    count = 1,
    skipVideo = false,
    imageModel = 'gemini',
    service = 'sora',
  } = options;

  // ─── STEP 1: Deep Analysis ───────────────────────────────────────────────
  const analysis = await deepAnalyze(url);

  const cuts = analysis.cutSegments;
  const isMultiCut = cuts.length > 1;
  const targetCount = isMultiCut ? cuts.length : count;

  logger.section(`PIPELINE: ${isMultiCut ? `Multi-cut (${cuts.length} cuts)` : `Single scene (${targetCount} variations)`}`);

  // ─── STEP 2: Original Version Proposal (REQUIRED per rule 4.5) ──────────
  logger.section('ORIGINAL VERSION PROPOSAL');
  const { proposalText, concept } = await generateOriginalVersionProposal(analysis);
  console.log(proposalText);

  const answer = await promptUser('');

  let approvedConcept = concept;
  if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
    logger.warn('Pipeline aborted by user.');
    return;
  }
  if (answer && answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    // User provided modifications
    logger.info('Applying user modifications...');
    approvedConcept = { ...concept, userModification: answer };
    const modification = answer.toLowerCase();
    if (modification.includes('題材')) {
      const match = modification.match(/題材[：:]\s*(.+)/);
      if (match) approvedConcept.subject = match[1].trim();
    }
    console.log('Updated concept:', approvedConcept);
    const confirm = await promptUser('この方向でいいですか？ (y/n)');
    if (confirm.toLowerCase() !== 'y') {
      logger.warn('Pipeline aborted.');
      return;
    }
  }

  // ─── STEP 3: Generate Image Prompts ──────────────────────────────────────
  logger.section('GENERATING IMAGE PROMPTS');

  let imagePromptData;
  if (isMultiCut) {
    // One prompt per cut
    imagePromptData = await generateImagePrompts(analysis, approvedConcept);
  } else {
    // Single scene: generate N variations
    const basePrompts = await generateImagePrompts(analysis, approvedConcept);
    imagePromptData = Array.from({ length: targetCount }, (_, i) => ({
      ...basePrompts[0],
      cutIndex: i,
      cutDescription: `Variation ${i + 1}`,
    }));
  }

  // ─── STEP 4: Generate Images ──────────────────────────────────────────────
  logger.section('GENERATING IMAGES');

  const imageItems = imagePromptData.map((pd, i) => {
    const item = {
      prompt: pd.prompt,
      filename: `cut${String(pd.cutIndex).padStart(2, '0')}_${Date.now()}_${i}.jpg`,
    };

    // Attach reference frame if available
    if (isMultiCut && analysis.cutFrames[i]?.framePath) {
      const framePath = analysis.cutFrames[i].framePath;
      if (fs.existsSync(framePath)) {
        item.referenceBase64 = imageToBase64(framePath);
      }
    }

    return item;
  });

  const imageResults = await generateImages(imageItems, { model: imageModel });
  const successfulImages = imageResults.filter(r => r.success);

  logger.success(`Generated ${successfulImages.length} / ${imageResults.length} images`);
  successfulImages.forEach(r => logger.info(`  Image: ${r.filepath}`));

  // ─── STEP 5: Generate Videos ──────────────────────────────────────────────
  const videoPaths = [];

  if (!skipVideo && successfulImages.length > 0) {
    logger.section('GENERATING VIDEOS');

    for (let i = 0; i < successfulImages.length; i++) {
      const imgResult = successfulImages[i];
      const cut = cuts[imgResult.index] || cuts[0];
      const cutForVideo = {
        index: imgResult.index,
        duration: cut.duration || 10,
        description: imagePromptData[imgResult.index]?.cutDescription || '',
        start: cut.start || 0,
        end: cut.end || 10,
      };

      logger.section(`Video ${i + 1} / ${successfulImages.length}`);

      // Generate Sora prompt
      const soraData = await generateSoraPrompt(analysis, cutForVideo, approvedConcept);
      logger.info(`Sora prompt: ${soraData.sora_prompt.slice(0, 100)}...`);

      const imageBase64 = imageToBase64(imgResult.filepath);
      const videoFilename = `video_cut${String(cutForVideo.index).padStart(2, '0')}_${Date.now()}.mp4`;

      try {
        if (service === 'sora' || service === 'both') {
          const soraPath = await generateSoraVideo(soraData.sora_prompt, {
            duration: Math.round(cutForVideo.duration) || 10,
            size: '720x1280',
            filename: videoFilename.replace('.mp4', '_sora.mp4'),
          });
          videoPaths.push(soraPath);
        }

        if (service === 'kling' || service === 'both') {
          const klingPath = await generateKlingVideo(imageBase64, soraData.sora_prompt, {
            duration: Math.min(Math.round(cutForVideo.duration), 10),
            aspectRatio: '9:16',
            filename: videoFilename.replace('.mp4', '_kling.mp4'),
          });
          videoPaths.push(klingPath);
        }
      } catch (err) {
        logger.error(`Video generation failed for cut ${cutForVideo.index}: ${err.message}`);
      }
    }
  }

  // ─── STEP 6: Self-Assessment Report ──────────────────────────────────────
  logger.section('SELF-ASSESSMENT REPORT');
  await createSelfAssessmentReport(url, analysis, imageResults, videoPaths, approvedConcept);

  logger.section('PIPELINE COMPLETE');
  logger.success(`Images: ${successfulImages.length}`);
  logger.success(`Videos: ${videoPaths.length}`);
  videoPaths.forEach(p => logger.info(`  ${p}`));

  return { analysis, imageResults, videoPaths };
}

async function createSelfAssessmentReport(url, analysis, imageResults, videoPaths, concept) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const successImages = imageResults.filter(r => r.success);

  const report = `# 自己採点レポート（自動生成）
日時: ${now}
参考動画: ${url}
生成画像: ${successImages.map(r => path.basename(r.filepath)).join(', ')}
生成動画: ${videoPaths.map(p => path.basename(p)).join(', ') || 'なし（--skip-video）'}

## 採用したオリジナルバージョン
- 題材: ${concept.subject}
- 設定: ${concept.setting}
- キャラ: ${concept.character || '未設定'}
- スタイル維持: ${concept.styleToMaintain}

## 元動画との比較
（review コマンドで詳細な比較分析を実行してください）
npm start -- review ${url} ${videoPaths.join(' ')}

## 生成結果サマリー
- 画像生成: ${successImages.length} / ${imageResults.length} 成功
- 動画生成: ${videoPaths.length} 本

## 改善案
- 詳細な自己採点は review コマンドで実行してください
- 各カットの尺・スタイルは元動画のデータを参照してください
`;

  const reportName = timestampedName('pipeline_report', 'txt');
  const reportPath = saveReport(report, reportName);
  logger.success(`Self-assessment report saved: ${reportPath}`);
}
