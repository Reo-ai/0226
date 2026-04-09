import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { saveVideo, timestampedName } from '../utils/fileUtils.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SORA_MODEL = process.env.OPENAI_SORA_MODEL || 'sora-2';

/**
 * Generate a video using OpenAI Sora 2 PRO.
 * Uses the /v1/video/generations endpoint.
 *
 * @param {string} prompt - Japanese video generation prompt
 * @param {object} options
 * @param {number} [options.duration=10] - Duration in seconds
 * @param {string} [options.size='720x1280'] - Video dimensions (WxH)
 * @param {string} [options.filename] - Output filename
 * @returns {string} Saved file path
 */
export async function generateVideo(prompt, options = {}) {
  const {
    duration = 10,
    size = '720x1280',
    filename,
  } = options;

  logger.step(`Generating Sora video (${duration}s, ${size})...`);
  logger.debug('Prompt:', prompt);

  // Call Sora API via raw HTTP (SDK may not yet expose this endpoint)
  const response = await axios.post(
    'https://api.openai.com/v1/video/generations',
    {
      model: SORA_MODEL,
      prompt,
      size,
      duration,
      n: 1,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 300_000, // 5 minutes
    }
  );

  const data = response.data;

  // Handle sync response (URL or base64)
  if (data.data?.[0]?.url) {
    const videoUrl = data.data[0].url;
    logger.info('Downloading Sora video...');
    const videoResp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120_000 });
    const outName = filename || timestampedName('sora', 'mp4');
    const filepath = saveVideo(Buffer.from(videoResp.data), outName);
    logger.success(`Sora video saved: ${filepath}`);
    return filepath;
  }

  // Handle async job response
  if (data.id) {
    return await pollSoraJob(data.id, filename);
  }

  throw new Error(`Unexpected Sora response: ${JSON.stringify(data)}`);
}

async function pollSoraJob(jobId, filename, maxWaitMs = 600_000) {
  logger.info(`Polling Sora job: ${jobId}`);
  const start = Date.now();
  const pollInterval = 10_000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const resp = await axios.get(
      `https://api.openai.com/v1/video/generations/${jobId}`,
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      }
    );

    const job = resp.data;
    logger.debug(`Sora job status: ${job.status}`);

    if (job.status === 'completed' || job.status === 'succeeded') {
      const videoUrl = job.result?.url || job.data?.[0]?.url;
      if (!videoUrl) throw new Error('Sora job completed but no URL found');

      const videoResp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120_000 });
      const outName = filename || timestampedName('sora', 'mp4');
      const filepath = saveVideo(Buffer.from(videoResp.data), outName);
      logger.success(`Sora video saved: ${filepath}`);
      return filepath;
    }

    if (job.status === 'failed' || job.status === 'error') {
      throw new Error(`Sora job failed: ${JSON.stringify(job.error)}`);
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    logger.info(`Waiting for Sora... ${elapsed}s elapsed`);
  }

  throw new Error(`Sora job timed out after ${maxWaitMs / 1000}s`);
}
