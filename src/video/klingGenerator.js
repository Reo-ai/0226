import { SignJWT } from 'jose';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { saveVideo, timestampedName } from '../utils/fileUtils.js';

const KLING_BASE = 'https://api.klingai.com';

/**
 * Generate Kling AI JWT token.
 */
async function getKlingToken() {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY must be set in .env');
  }

  const now = Math.floor(Date.now() / 1000);
  const secret = new TextEncoder().encode(secretKey);

  const token = await new SignJWT({ iss: accessKey })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now - 5)
    .setExpirationTime(now + 1800)
    .sign(secret);

  return token;
}

function klingHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Generate a video from text using Kling AI.
 *
 * @param {string} prompt - Video description prompt (English or Chinese)
 * @param {object} options
 * @param {string} [options.model='kling-v1'] - Kling model version
 * @param {number} [options.duration=10] - Duration in seconds (5 or 10)
 * @param {string} [options.aspectRatio='9:16'] - Aspect ratio
 * @param {string} [options.mode='std'] - 'std' or 'pro'
 * @param {string} [options.filename] - Output filename
 * @returns {string} Saved file path
 */
export async function generateVideoFromText(prompt, options = {}) {
  const {
    model = 'kling-v1',
    duration = 10,
    aspectRatio = '9:16',
    mode = 'std',
    filename,
  } = options;

  logger.step(`Generating Kling AI video (text-to-video, ${duration}s)...`);
  const token = await getKlingToken();

  const body = {
    model_name: model,
    prompt,
    duration,
    aspect_ratio: aspectRatio,
    mode,
  };

  const resp = await axios.post(`${KLING_BASE}/v1/videos/text2video`, body, {
    headers: klingHeaders(token),
  });

  const taskId = resp.data?.data?.task_id;
  if (!taskId) {
    throw new Error(`Kling: no task_id in response: ${JSON.stringify(resp.data)}`);
  }

  logger.info(`Kling task created: ${taskId}`);
  return await pollKlingTask(taskId, 'text2video', filename);
}

/**
 * Generate a video from an image using Kling AI.
 *
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} prompt - Motion description prompt
 * @param {object} options
 * @returns {string} Saved file path
 */
export async function generateVideoFromImage(imageBase64, prompt, options = {}) {
  const {
    model = 'kling-v1',
    duration = 10,
    aspectRatio = '9:16',
    mode = 'std',
    filename,
  } = options;

  logger.step(`Generating Kling AI video (image-to-video, ${duration}s)...`);
  const token = await getKlingToken();

  const body = {
    model_name: model,
    prompt,
    image: imageBase64,
    duration,
    aspect_ratio: aspectRatio,
    mode,
  };

  const resp = await axios.post(`${KLING_BASE}/v1/videos/image2video`, body, {
    headers: klingHeaders(token),
  });

  const taskId = resp.data?.data?.task_id;
  if (!taskId) {
    throw new Error(`Kling: no task_id in response: ${JSON.stringify(resp.data)}`);
  }

  logger.info(`Kling task created: ${taskId}`);
  return await pollKlingTask(taskId, 'image2video', filename);
}

async function pollKlingTask(taskId, endpoint, filename, maxWaitMs = 600_000) {
  const start = Date.now();
  const pollInterval = 10_000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const token = await getKlingToken();
    const resp = await axios.get(
      `${KLING_BASE}/v1/videos/${endpoint}/${taskId}`,
      { headers: klingHeaders(token) }
    );

    const task = resp.data?.data;
    const status = task?.task_status;
    logger.debug(`Kling task status: ${status}`);

    if (status === 'succeed') {
      const videoUrl = task?.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error('Kling task succeeded but no video URL');

      logger.info('Downloading Kling video...');
      const videoResp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120_000 });
      const outName = filename || timestampedName('kling', 'mp4');
      const filepath = saveVideo(Buffer.from(videoResp.data), outName);
      logger.success(`Kling video saved: ${filepath}`);
      return filepath;
    }

    if (status === 'failed') {
      throw new Error(`Kling task failed: ${JSON.stringify(task?.task_status_msg)}`);
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    logger.info(`Waiting for Kling... ${elapsed}s (status: ${status})`);
  }

  throw new Error(`Kling task timed out after ${maxWaitMs / 1000}s`);
}
