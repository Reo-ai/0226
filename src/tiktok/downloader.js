import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { tmpPath, DIRS } from '../utils/fileUtils.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Download TikTok video using yt-dlp.
 * Requires yt-dlp to be installed: pip install yt-dlp
 */
export async function downloadVideo(url) {
  const outPath = tmpPath(`video_${Date.now()}.mp4`);
  logger.step(`Downloading video: ${url}`);

  try {
    await execAsync(
      `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" ` +
      `--merge-output-format mp4 -o "${outPath}" "${url}"`
    );
  } catch (err) {
    throw new Error(`yt-dlp failed: ${err.message}\nInstall with: pip install yt-dlp`);
  }

  if (!fs.existsSync(outPath)) {
    throw new Error(`Download failed: output file not found at ${outPath}`);
  }

  logger.success(`Downloaded: ${outPath}`);
  return outPath;
}

/**
 * Extract audio from video file.
 */
export async function extractAudio(videoPath) {
  const audioPath = videoPath.replace(/\.[^.]+$/, '.mp3');
  await execAsync(`ffmpeg -y -i "${videoPath}" -vn -ar 44100 -ac 2 -b:a 192k "${audioPath}" 2>/dev/null`);
  return audioPath;
}

/**
 * Get video duration in seconds.
 */
export async function getVideoDuration(videoPath) {
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
  );
  return parseFloat(stdout.trim());
}

/**
 * Extract frames at regular intervals.
 * Returns array of frame file paths.
 */
export async function extractFrames(videoPath, intervalSec = 1.0) {
  const framesDir = tmpPath(`frames_${Date.now()}`);
  fs.mkdirSync(framesDir, { recursive: true });

  const outPattern = path.join(framesDir, 'frame_%04d.jpg');
  await execAsync(
    `ffmpeg -y -i "${videoPath}" -vf "fps=1/${intervalSec}" -q:v 2 "${outPattern}" 2>/dev/null`
  );

  const frames = fs.readdirSync(framesDir)
    .filter(f => f.endsWith('.jpg'))
    .sort()
    .map(f => path.join(framesDir, f));

  logger.info(`Extracted ${frames.length} frames`);
  return frames;
}

/**
 * Detect scene cuts using ffmpeg scene detection.
 * Returns array of cut timestamps in seconds.
 */
export async function detectCuts(videoPath, threshold = 0.3) {
  logger.step('Detecting scene cuts...');
  const logPath = tmpPath(`cuts_${Date.now()}.txt`);

  try {
    await execAsync(
      `ffmpeg -y -i "${videoPath}" ` +
      `-vf "select='gt(scene,${threshold})',metadata=print:file=${logPath}" ` +
      `-vsync 0 -f null - 2>/dev/null`
    );
  } catch {
    // ffmpeg exits with non-zero when using select filter sometimes
  }

  const cuts = [0];
  if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf-8');
    const matches = content.matchAll(/pts_time:([\d.]+)/g);
    for (const m of matches) {
      cuts.push(parseFloat(m[1]));
    }
  }

  const duration = await getVideoDuration(videoPath);
  cuts.push(duration);

  // Build cut segments
  const segments = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    segments.push({
      index: i,
      start: cuts[i],
      end: cuts[i + 1],
      duration: cuts[i + 1] - cuts[i],
    });
  }

  logger.success(`Detected ${segments.length} cut(s)`);
  return segments;
}

/**
 * Extract one representative frame per cut segment.
 */
export async function extractCutFrames(videoPath, segments) {
  const frames = [];
  for (const seg of segments) {
    const midpoint = seg.start + seg.duration / 2;
    const framePath = tmpPath(`cut_${seg.index}_${Date.now()}.jpg`);
    await execAsync(
      `ffmpeg -y -ss ${midpoint} -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" 2>/dev/null`
    );
    if (fs.existsSync(framePath)) {
      frames.push({ segment: seg, path: framePath });
    }
  }
  return frames;
}

/**
 * Convert image file to base64 string.
 */
export function imageToBase64(imagePath) {
  return fs.readFileSync(imagePath).toString('base64');
}
