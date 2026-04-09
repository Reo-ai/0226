import RunwayML from '@runwayml/sdk';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { saveVideo, timestampedName } from '../utils/fileUtils.js';

function getClient() {
  return new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });
}

/**
 * Runway mode selector based on use case.
 *
 * Modes:
 *  - imageToVideo (gen4_turbo, gen4.5, veo3.1)
 *  - videoToVideo (gen4_aleph)
 *  - actTwo / characterPerformance (act_two)
 *  - textToVideo
 */

/**
 * Generate video from image (imageToVideo).
 *
 * @param {string} imageBase64 - Base64 image (or data URI)
 * @param {string} prompt - Scene description (English)
 * @param {object} options
 * @param {string} [options.model='gen4_turbo'] - Runway model
 * @param {number} [options.duration=10] - Duration in seconds
 * @param {string} [options.ratio='720:1280'] - Aspect ratio
 * @param {boolean} [options.publicFigure=false] - Enable public figure mode
 * @param {string} [options.filename] - Output filename
 * @returns {string} Saved file path
 */
export async function imageToVideo(imageBase64, prompt, options = {}) {
  const {
    model = 'gen4_turbo',
    duration = 10,
    ratio = '720:1280',
    publicFigure = false,
    filename,
  } = options;

  logger.step(`Generating Runway video (imageToVideo, model: ${model}, ${duration}s)...`);

  const client = getClient();
  const dataUri = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const taskParams = {
    model,
    promptImage: dataUri,
    promptText: prompt,
    duration,
    ratio,
  };

  if (publicFigure) {
    taskParams.contentModeration = { publicFigureThreshold: 'low' };
  }

  const task = await client.imageToVideo.create(taskParams);
  return await pollRunwayTask(task.id, filename);
}

/**
 * Generate video from video (videoToVideo style transfer).
 */
export async function videoToVideo(videoPath, prompt, options = {}) {
  const {
    model = 'gen4_aleph',
    duration = 10,
    ratio = '720:1280',
    filename,
  } = options;

  logger.step(`Generating Runway video (videoToVideo, model: ${model})...`);
  const client = getClient();

  const task = await client.videoToVideo.create({
    model,
    promptVideo: videoPath,
    promptText: prompt,
    duration,
    ratio,
  });

  return await pollRunwayTask(task.id, filename);
}

/**
 * Generate video using Act-Two (character performance transfer).
 */
export async function actTwo(referenceVideoPath, imageBase64, options = {}) {
  const {
    bodyControl = true,
    expressionIntensity = 3,
    duration = 10,
    ratio = '720:1280',
    filename,
  } = options;

  logger.step('Generating Runway video (Act-Two character performance)...');
  const client = getClient();

  const dataUri = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const task = await client.imageToVideo.create({
    model: 'act_two',
    referenceVideo: referenceVideoPath,
    promptImage: dataUri,
    bodyControl,
    expressionIntensity,
    duration,
    ratio,
  });

  return await pollRunwayTask(task.id, filename);
}

/**
 * Generate video from text only.
 */
export async function textToVideo(prompt, options = {}) {
  const {
    duration = 10,
    ratio = '720:1280',
    filename,
  } = options;

  logger.step('Generating Runway video (textToVideo)...');
  const client = getClient();

  const task = await client.textToVideo.create({
    promptText: prompt,
    duration,
    ratio,
  });

  return await pollRunwayTask(task.id, filename);
}

async function pollRunwayTask(taskId, filename, maxWaitMs = 600_000) {
  logger.info(`Polling Runway task: ${taskId}`);
  const client = getClient();
  const start = Date.now();
  const pollInterval = 10_000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const task = await client.tasks.retrieve(taskId);
    logger.debug(`Runway task status: ${task.status}`);

    if (task.status === 'SUCCEEDED') {
      const videoUrl = task.output?.[0];
      if (!videoUrl) throw new Error('Runway task succeeded but no output URL');

      logger.info('Downloading Runway video...');
      const resp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120_000 });
      const outName = filename || timestampedName('runway', 'mp4');
      const filepath = saveVideo(Buffer.from(resp.data), outName);
      logger.success(`Runway video saved: ${filepath}`);
      return filepath;
    }

    if (task.status === 'FAILED') {
      throw new Error(`Runway task failed: ${JSON.stringify(task.failure)}`);
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    logger.info(`Waiting for Runway... ${elapsed}s (status: ${task.status})`);
  }

  throw new Error(`Runway task timed out after ${maxWaitMs / 1000}s`);
}
