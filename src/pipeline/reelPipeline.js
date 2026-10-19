import { logger } from '../utils/logger.js';
import { saveReport, timestampedName } from '../utils/fileUtils.js';
import {
  generateVideoConcept,
  generateSelfImprovementImagePrompt,
  generateSelfImprovementVideoPrompt,
} from './contentStrategy.js';
import { generateCaption } from './captionGenerator.js';
import { generateImage } from '../gemini/imageGenerator.js';
import { generateVideo as soraGenerate } from '../video/soraGenerator.js';
import { generateVideoFromImage as klingGenerate } from '../video/klingGenerator.js';
import { imageToBase64 } from '../tiktok/downloader.js';

/**
 * Full reel pipeline: concept → image → video → caption.
 *
 * @param {string} theme - Theme ID
 * @param {object} opts
 * @param {string} [opts.type='educational'] - Content type
 * @param {string} [opts.product] - Affiliate product
 * @param {string} [opts.script] - Existing script to base the concept on
 * @param {string} [opts.caption] - Use this caption instead of generating one
 * @param {string} [opts.imageModel='gemini']
 * @param {string} [opts.service='sora'] - sora, kling, or both
 * @param {boolean} [opts.skipVideo=false]
 * @param {number} [opts.duration=30]
 * @param {string} [opts.account]
 * @returns {object} { concept, imagePath, videoPaths, caption, summaryPath }
 */
export async function runReel(theme, opts = {}) {
  const { type = 'educational', imageModel = 'gemini', service = 'sora', skipVideo = false, duration = 30 } = opts;

  // Step 1: Generate concept
  logger.section('STEP 1: VIDEO CONCEPT');
  const concept = await generateVideoConcept(theme, {
    hookType: type,
    affiliateProduct: opts.product,
    script: opts.script,
  });
  logger.success(`Hook: ${concept.hook}`);
  console.log(JSON.stringify(concept, null, 2));

  // Step 2: Generate image prompt
  logger.section('STEP 2: IMAGE GENERATION');
  const imagePrompt = await generateSelfImprovementImagePrompt(theme, concept, 0);
  logger.info(`Prompt: ${imagePrompt.slice(0, 100)}...`);

  const imagePath = await generateImage(imagePrompt, {
    model: imageModel,
    filename: timestampedName(`${theme}_reel`, 'jpg'),
  });

  // Step 3: Generate video
  const videoPaths = [];
  const videoErrors = [];
  if (!skipVideo) {
    logger.section('STEP 3: VIDEO GENERATION');
    const cut = { index: 0, duration, description: concept.structure?.[0]?.content };
    const soraData = await generateSelfImprovementVideoPrompt(theme, concept, cut);
    logger.info(`Sora prompt: ${soraData.sora_prompt.slice(0, 120)}...`);

    const imageBase64 = imageToBase64(imagePath);

    if (service === 'sora' || service === 'both') {
      try {
        const p = await soraGenerate(soraData.sora_prompt, {
          duration,
          size: '720x1280',
          filename: timestampedName(`${theme}_sora`, 'mp4'),
        });
        videoPaths.push(p);
      } catch (e) {
        logger.error(`Sora failed: ${e.message}`);
        videoErrors.push(`Sora: ${e.message}`);
      }
    }

    if (service === 'kling' || service === 'both') {
      try {
        const p = await klingGenerate(imageBase64, soraData.sora_prompt, {
          duration: Math.min(duration, 10),
          aspectRatio: '9:16',
          filename: timestampedName(`${theme}_kling`, 'mp4'),
        });
        videoPaths.push(p);
      } catch (e) {
        logger.error(`Kling failed: ${e.message}`);
        videoErrors.push(`Kling: ${e.message}`);
      }
    }
  }

  // Step 4: Generate caption
  logger.section('STEP 4: CAPTION');
  const caption = opts.caption
    ? { fullCaption: opts.caption }
    : await generateCaption(theme, {
        concept: concept.title + ' - ' + concept.hook,
        affiliateProduct: opts.product,
        affiliateLink: 'プロフィールリンク',
        tone: type === 'story' ? 'story' : type === 'review' ? 'review' : 'motivational',
        accountHandle: opts.account,
      });

  console.log('\n═══ CAPTION ═══\n');
  console.log(caption.fullCaption);

  // Save summary
  const summary = [
    `# Reel Summary: ${theme}`,
    `Date: ${new Date().toISOString()}`,
    '',
    `## Concept`,
    JSON.stringify(concept, null, 2),
    '',
    `## Image`,
    imagePath,
    '',
    `## Videos`,
    videoPaths.join('\n') || (skipVideo ? 'None (--skip-video)' : 'None (failed)'),
    '',
    `## Caption`,
    caption.fullCaption,
  ].join('\n');

  const summaryPath = saveReport(summary, timestampedName(`reel_${theme}`, 'txt'));
  logger.success(`Summary saved: ${summaryPath}`);

  logger.section('DONE');
  logger.success(`Image: ${imagePath}`);
  videoPaths.forEach(p => logger.success(`Video: ${p}`));

  return { concept, imagePath, videoPaths, videoErrors, caption, summaryPath };
}
