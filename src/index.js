import 'dotenv/config';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';
import { ensureDirs, readJSON } from './utils/fileUtils.js';

// Ensure output directories exist at startup
ensureDirs();

program
  .name('tiktok-pipeline')
  .description('TikTok Auto Pipeline: analyze → generate images → generate videos')
  .version('1.0.0');

// ─── deep-analyze ───────────────────────────────────────────────────────────
program
  .command('deep-analyze <url>')
  .description('Perform deep analysis of a TikTok video (vision, audio, structure)')
  .action(async (url) => {
    const { deepAnalyze } = await import('./pipeline/deepAnalyzer.js');
    try {
      await deepAnalyze(url);
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── deep-pipeline ──────────────────────────────────────────────────────────
program
  .command('deep-pipeline <url>')
  .description('Full pipeline: analyze → propose → generate images → generate videos')
  .option('-c, --count <n>', 'Number of variations (overridden by cut count)', parseInt, 1)
  .option('--skip-video', 'Generate images only, skip video generation', false)
  .option('--reference-frames', 'Use reference frames for image generation', false)
  .option('--image-model <model>', 'Image model: gemini or imagen', 'gemini')
  .option('-s, --service <service>', 'Video service: sora, kling, or both', 'sora')
  .action(async (url, opts) => {
    const { deepPipeline } = await import('./pipeline/deepPipeline.js');
    try {
      await deepPipeline(url, {
        count: opts.count,
        skipVideo: opts.skipVideo,
        referenceFrames: opts.referenceFrames,
        imageModel: opts.imageModel,
        service: opts.service,
      });
    } catch (err) {
      logger.error(err.message);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

// ─── review ─────────────────────────────────────────────────────────────────
program
  .command('review <reference> [videoPaths...]')
  .description('Review generated video(s) against reference (URL or local path)')
  .action(async (reference, videoPaths) => {
    if (!videoPaths || videoPaths.length === 0) {
      logger.error('Please provide at least one generated video path.');
      process.exit(1);
    }
    const { reviewVideos } = await import('./pipeline/reviewer.js');
    try {
      await reviewVideos(reference, videoPaths);
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── analyze ────────────────────────────────────────────────────────────────
program
  .command('analyze')
  .description('Analyze TikTok trends')
  .action(async () => {
    const { analyzeTrends } = await import('./tiktok/analyzer.js');
    try {
      logger.section('TIKTOK TREND ANALYSIS');
      const result = await analyzeTrends();
      console.log('\n' + result);
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── generate-images-batch ──────────────────────────────────────────────────
program
  .command('generate-images-batch')
  .description('Generate images in batch from a prompts JSON file')
  .option('-f, --file <path>', 'Prompts file path (JSON array)', 'prompts.json')
  .option('--image-model <model>', 'Image model: gemini or imagen', 'gemini')
  .option('--enhance', 'Enhance prompts with GPT before generating', false)
  .action(async (opts) => {
    const { generateImages } = await import('./gemini/imageGenerator.js');
    const { enhancePromptForImage } = await import('./pipeline/promptGenerator.js');

    const promptsFile = path.resolve(opts.file);
    if (!fs.existsSync(promptsFile)) {
      logger.error(`Prompts file not found: ${promptsFile}`);
      logger.info('Expected format: [{"prompt": "...", "filename": "..."}, ...]');
      process.exit(1);
    }

    let items;
    try {
      items = readJSON(promptsFile);
      if (!Array.isArray(items)) items = [items];
    } catch (err) {
      logger.error(`Invalid JSON in prompts file: ${err.message}`);
      process.exit(1);
    }

    logger.section(`BATCH IMAGE GENERATION (${items.length} images)`);

    if (opts.enhance) {
      logger.step('Enhancing prompts with GPT...');
      for (const item of items) {
        item.prompt = await enhancePromptForImage(item.prompt);
      }
    }

    try {
      const results = await generateImages(items, { model: opts.imageModel });
      const success = results.filter(r => r.success);
      logger.section('DONE');
      logger.success(`${success.length} / ${results.length} images generated`);
      success.forEach(r => logger.info(`  ${r.filepath}`));
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
