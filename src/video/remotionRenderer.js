import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { saveReport, timestampedName, DIRS, ROOT } from '../utils/fileUtils.js';

const execAsync = promisify(exec);

const REMOTION_ENTRY = path.join(ROOT, 'src/remotion/index.tsx');

/**
 * Render a SelfImprovementReel using Remotion.
 *
 * @param {object} props - Props to pass to the SelfImprovementReel composition
 * @param {object} options
 * @param {string} [options.composition='SelfImprovementReel'] - Composition ID
 * @param {number} [options.fps=30] - Frames per second
 * @param {number} [options.durationSec=30] - Duration in seconds
 * @param {string} [options.filename] - Output filename
 * @returns {string} Output video path
 */
export async function renderReel(props, options = {}) {
  const {
    composition = 'SelfImprovementReel',
    fps = 30,
    durationSec = 30,
    filename,
  } = options;

  const outName = filename || timestampedName(`remotion_${props.theme || 'reel'}`, 'mp4');
  const outPath = path.join(DIRS.videos, outName);

  const durationInFrames = durationSec * fps;
  const propsJson = JSON.stringify({ ...props, imagePath: props.imagePath || '' });
  const escapedProps = propsJson.replace(/'/g, "\\'");

  logger.step(`Rendering Remotion: ${composition} (${durationSec}s @ ${fps}fps)...`);
  logger.debug('Props:', propsJson);

  const cmd = [
    `npx remotion render`,
    `"${REMOTION_ENTRY}"`,
    composition,
    `"${outPath}"`,
    `--props='${escapedProps}'`,
    `--frames=0-${durationInFrames - 1}`,
    `--fps=${fps}`,
    `--width=720`,
    `--height=1280`,
    `--log=verbose`,
  ].join(' ');

  logger.debug('Command:', cmd);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: ROOT,
      timeout: 300_000,
      env: { ...process.env, NODE_ENV: 'production' },
    });
    if (stdout) logger.debug(stdout.slice(-500));
    if (stderr && !stderr.includes('Rendered')) logger.debug(stderr.slice(-300));
  } catch (err) {
    throw new Error(`Remotion render failed: ${err.message}`);
  }

  if (!fs.existsSync(outPath)) {
    throw new Error(`Remotion render completed but output not found: ${outPath}`);
  }

  logger.success(`Remotion video saved: ${outPath}`);
  return outPath;
}

/**
 * Render a SubtitleReel (transparent overlay) to WebM with alpha channel.
 * Use this to composite subtitles over an existing AI-generated video.
 *
 * @param {object} props - SubtitleReel props
 * @param {number} durationSec
 * @returns {string} Output WebM path
 */
export async function renderSubtitleOverlay(props, durationSec = 30) {
  const fps = 30;
  const outName = timestampedName('subtitles_overlay', 'webm');
  const outPath = path.join(DIRS.videos, outName);

  const durationInFrames = durationSec * fps;
  const escapedProps = JSON.stringify(props).replace(/'/g, "\\'");

  logger.step('Rendering subtitle overlay (transparent WebM)...');

  const cmd = [
    `npx remotion render`,
    `"${REMOTION_ENTRY}"`,
    'SubtitleReel',
    `"${outPath}"`,
    `--props='${escapedProps}'`,
    `--frames=0-${durationInFrames - 1}`,
    `--fps=${fps}`,
    `--width=720`,
    `--height=1280`,
    `--codec=vp8`,
  ].join(' ');

  try {
    await execAsync(cmd, { cwd: ROOT, timeout: 300_000 });
  } catch (err) {
    throw new Error(`Remotion overlay render failed: ${err.message}`);
  }

  logger.success(`Subtitle overlay saved: ${outPath}`);
  return outPath;
}

/**
 * Composite subtitle overlay WebM over a base video using ffmpeg.
 *
 * @param {string} baseVideoPath - Background video (MP4)
 * @param {string} overlayPath - Subtitle overlay (WebM with alpha)
 * @param {string} [outputFilename]
 * @returns {string} Output MP4 path
 */
export async function compositeSubtitles(baseVideoPath, overlayPath, outputFilename) {
  const outName = outputFilename || timestampedName('final_with_subtitles', 'mp4');
  const outPath = path.join(DIRS.videos, outName);

  logger.step('Compositing subtitles over base video...');

  const cmd = `ffmpeg -y -i "${baseVideoPath}" -i "${overlayPath}" ` +
    `-filter_complex "[0:v][1:v]overlay=0:0[v]" -map "[v]" -map 0:a? ` +
    `-c:v libx264 -c:a aac -shortest "${outPath}" 2>/dev/null`;

  try {
    await execAsync(cmd);
  } catch (err) {
    throw new Error(`ffmpeg composite failed: ${err.message}`);
  }

  logger.success(`Final video with subtitles: ${outPath}`);
  return outPath;
}
