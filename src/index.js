import 'dotenv/config';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';
import { ensureDirs, readJSON } from './utils/fileUtils.js';
import { THEME_IDS } from './config/themes.js';

// commander は (値, 既定値) で呼ぶので、parseInt を直接渡すと既定値が基数になってしまう
const toInt = (v) => parseInt(v, 10);

// Ensure output directories exist at startup
ensureDirs();

program
  .name('tiktok-pipeline')
  .description('TikTok Auto Pipeline: analyze → generate images → generate videos\n自己啓発×アフィリエイト特化')
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
  .option('-c, --count <n>', 'Number of variations (overridden by cut count)', toInt, 1)
  .option('--skip-video', 'Generate images only, skip video generation', false)
  .option('--reference-frames', 'Use reference frames for image generation', false)
  .option('--image-model <model>', 'Image model: gemini or imagen', 'gemini')
  .option('-s, --service <service>', 'Video service: sora, kling, or both', 'sora')
  .option('-t, --theme <theme>', `Self-improvement theme: ${THEME_IDS.join('|')}`)
  .action(async (url, opts) => {
    const { deepPipeline } = await import('./pipeline/deepPipeline.js');
    try {
      await deepPipeline(url, {
        count: opts.count,
        skipVideo: opts.skipVideo,
        referenceFrames: opts.referenceFrames,
        imageModel: opts.imageModel,
        service: opts.service,
        theme: opts.theme,
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

// ─── plan-content ────────────────────────────────────────────────────────────
program
  .command('plan-content')
  .description('Generate a weekly/monthly content calendar for self-improvement affiliate account')
  .option('-w, --weeks <n>', 'Number of weeks to plan', toInt, 1)
  .option('-t, --themes <themes>', `Comma-separated theme IDs: ${THEME_IDS.join(',')}`, THEME_IDS.join(','))
  .option('-a, --account <handle>', 'Instagram account handle', 'your_account')
  .option('--affiliate-links <links>', 'Comma-separated affiliate product descriptions')
  .action(async (opts) => {
    const { generateContentPlan } = await import('./pipeline/contentStrategy.js');
    try {
      const themes = opts.themes.split(',').map(s => s.trim()).filter(Boolean);
      const affiliateLinks = opts.affiliateLinks
        ? opts.affiliateLinks.split(',').map(s => s.trim())
        : [];

      await generateContentPlan({
        themes,
        weeks: opts.weeks,
        accountHandle: opts.account,
        affiliateLinks,
      });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── generate-concept ────────────────────────────────────────────────────────
program
  .command('generate-concept <theme>')
  .description(`Generate a video concept for a self-improvement theme (${THEME_IDS.join('|')})`)
  .option('--type <type>', 'Content type: educational, hook, story, review', 'educational')
  .option('--product <product>', 'Specific affiliate product to feature')
  .action(async (theme, opts) => {
    const { generateVideoConcept } = await import('./pipeline/contentStrategy.js');
    try {
      logger.section(`VIDEO CONCEPT: ${theme}`);
      const concept = await generateVideoConcept(theme, {
        hookType: opts.type,
        affiliateProduct: opts.product,
      });
      console.log('\n' + JSON.stringify(concept, null, 2));
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── generate-caption ─────────────────────────────────────────────────────────
program
  .command('generate-caption <theme>')
  .description(`Generate Instagram caption with affiliate CTA (${THEME_IDS.join('|')})`)
  .option('-c, --concept <text>', 'Video concept description')
  .option('--product <product>', 'Affiliate product name')
  .option('--link <link>', 'Link label (e.g. "プロフィールリンク")', 'プロフィールリンク')
  .option('--tone <tone>', 'Caption tone: motivational, educational, story, review', 'motivational')
  .option('--account <handle>', 'Instagram handle')
  .action(async (theme, opts) => {
    const { generateCaption } = await import('./pipeline/captionGenerator.js');
    try {
      logger.section(`CAPTION GENERATOR: ${theme}`);
      const result = await generateCaption(theme, {
        concept: opts.concept || '',
        affiliateProduct: opts.product,
        affiliateLink: opts.link,
        tone: opts.tone,
        accountHandle: opts.account,
      });

      console.log('\n═══ FULL CAPTION ═══\n');
      console.log(result.fullCaption);
      console.log('\n═══ ALTERNATIVES ═══\n');
      result.altCaptions?.forEach((alt, i) => console.log(`${i + 1}. ${alt}`));
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── generate-reel ───────────────────────────────────────────────────────────
program
  .command('generate-reel <theme>')
  .description(`Full self-improvement reel pipeline: concept → image → video → caption (${THEME_IDS.join('|')})`)
  .option('--type <type>', 'Content type: educational, hook, story, review', 'educational')
  .option('--product <product>', 'Affiliate product to feature')
  .option('--image-model <model>', 'Image model: gemini or imagen', 'gemini')
  .option('-s, --service <service>', 'Video service: sora, kling, or both', 'sora')
  .option('--skip-video', 'Generate images only', false)
  .option('--duration <n>', 'Video duration in seconds', toInt, 30)
  .option('--account <handle>', 'Instagram handle')
  .action(async (theme, opts) => {
    const { runReel } = await import('./pipeline/reelPipeline.js');
    try {
      await runReel(theme, opts);
    } catch (err) {
      logger.error(err.message);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

// ─── generate-vrew-script ────────────────────────────────────────────────────
program
  .command('generate-vrew-script <theme>')
  .description(`Generate Vrew-ready narration script + SRT subtitles (${THEME_IDS.join('|')})`)
  .option('--type <type>', 'Content type: educational, hook, story, review', 'educational')
  .option('--product <product>', 'Affiliate product to feature')
  .option('--duration <n>', 'Target duration in seconds', toInt, 60)
  .option('--voice <style>', 'Voice style: friendly, energetic, calm, professional', 'friendly')
  .action(async (theme, opts) => {
    const { generateVideoConcept } = await import('./pipeline/contentStrategy.js');
    const { generateVrewScript } = await import('./pipeline/vrewExporter.js');
    try {
      logger.section(`VREW SCRIPT: ${theme}`);
      const concept = await generateVideoConcept(theme, {
        hookType: opts.type,
        affiliateProduct: opts.product,
      });
      await generateVrewScript(theme, concept, {
        durationSec: opts.duration,
        voiceStyle: opts.voice,
      });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── remotion-render ─────────────────────────────────────────────────────────
program
  .command('remotion-render <theme>')
  .description('Render a self-improvement reel video using Remotion (requires npm install)')
  .option('--hook <text>', 'Hook text for the video')
  .option('--image <path>', 'Background image path (output/images/xxx.jpg)')
  .option('--duration <n>', 'Duration in seconds', toInt, 30)
  .option('--cta <text>', 'CTA text', 'プロフリンクから詳しくチェック！')
  .option('--composition <id>', 'Composition ID: SelfImprovementReel or SubtitleReel', 'SelfImprovementReel')
  .action(async (theme, opts) => {
    const { renderReel } = await import('./video/remotionRenderer.js');
    const { getTheme } = await import('./config/themes.js');
    try {
      const themeConfig = getTheme(theme);
      logger.section(`REMOTION RENDER: ${themeConfig.emoji} ${themeConfig.label}`);

      const props = {
        theme,
        hook: opts.hook || themeConfig.hooks[0],
        narrationLines: [],   // populate from Vrew script or generate-vrew-script
        imagePath: opts.image ? require('path').resolve(opts.image) : '',
        ctaText: opts.cta,
        showCta: true,
      };

      const outPath = await renderReel(props, {
        composition: opts.composition,
        durationSec: opts.duration,
        fps: 30,
      });

      logger.success(`Rendered: ${outPath}`);
    } catch (err) {
      logger.error(err.message);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

// ─── hub-sync ────────────────────────────────────────────────────────────────
program
  .command('hub-sync')
  .description('affiliate-hub の「動画にする」ジョブを取得してリール生成し、結果を返す')
  .option('--limit <n>', 'Jobs per run', toInt, 3)
  .option('--loop <minutes>', 'Keep polling every N minutes', toInt)
  .option('--image-model <model>', 'Image model: gemini or imagen', 'gemini')
  .option('--duration <n>', 'Video duration in seconds', toInt, 30)
  .option('--account <handle>', 'Instagram handle')
  .action(async (opts) => {
    const { syncOnce } = await import('./pipeline/hubSync.js');
    try {
      do {
        await syncOnce(opts);
        if (opts.loop) {
          logger.info(`${opts.loop}分後に再確認します（Ctrl+Cで終了）`);
          await new Promise((r) => setTimeout(r, opts.loop * 60_000));
        }
      } while (opts.loop);
    } catch (err) {
      logger.error(err.message);
      if (process.env.DEBUG) console.error(err.stack);
      process.exit(1);
    }
  });

program.parse(process.argv);
