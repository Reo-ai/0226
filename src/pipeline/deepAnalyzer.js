import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { saveJSON, timestampedName, DIRS } from '../utils/fileUtils.js';
import {
  downloadVideo,
  extractAudio,
  extractFrames,
  detectCuts,
  extractCutFrames,
  getVideoDuration,
} from '../tiktok/downloader.js';
import {
  analyzeFrames,
  transcribeAudio,
  analyzeStructure,
} from '../tiktok/analyzer.js';

/**
 * Perform deep analysis of a TikTok video.
 *
 * @param {string} url - TikTok video URL
 * @param {object} options
 * @param {boolean} [options.keepTemp=false] - Keep temporary files
 * @returns {object} Full analysis result
 */
export async function deepAnalyze(url, options = {}) {
  logger.section('DEEP ANALYSIS');
  logger.info(`Target: ${url}`);

  // Step 1: Download video
  logger.section('Step 1: Download');
  const videoPath = await downloadVideo(url);

  // Step 2: Extract audio and transcribe
  logger.section('Step 2: Audio Transcription');
  let audioAnalysis = { text: '', segments: [], language: 'unknown' };
  try {
    const audioPath = await extractAudio(videoPath);
    audioAnalysis = await transcribeAudio(audioPath);
    logger.success(`Transcribed (${audioAnalysis.language}): "${audioAnalysis.text.slice(0, 100)}..."`);
  } catch (err) {
    logger.warn(`Audio transcription failed: ${err.message}`);
  }

  // Step 3: Detect cuts
  logger.section('Step 3: Cut Detection');
  let cutSegments = [];
  try {
    cutSegments = await detectCuts(videoPath);
    logger.success(`Detected ${cutSegments.length} cut(s)`);
  } catch (err) {
    logger.warn(`Cut detection failed: ${err.message}`);
    const duration = await getVideoDuration(videoPath);
    cutSegments = [{ index: 0, start: 0, end: duration, duration }];
  }

  // Step 4: Extract frames (representative frames per cut + general samples)
  logger.section('Step 4: Frame Extraction');
  const generalFrames = await extractFrames(videoPath, 2.0);
  const cutFrameData = await extractCutFrames(videoPath, cutSegments);
  logger.success(`Extracted ${generalFrames.length} general frames + ${cutFrameData.length} cut frames`);

  // Step 5: Vision analysis
  logger.section('Step 5: Vision Analysis');
  const visionAnalysis = await analyzeFrames(generalFrames);
  logger.success('Vision analysis complete');

  // Step 6: Structure analysis
  logger.section('Step 6: Structure Analysis');
  const structureAnalysis = await analyzeStructure(
    visionAnalysis,
    audioAnalysis,
    cutSegments,
    await getVideoDuration(videoPath)
  );
  logger.success('Structure analysis complete');

  // Compile result
  const result = {
    url,
    analyzedAt: new Date().toISOString(),
    videoPath,
    visionAnalysis,
    audioAnalysis,
    cutSegments,
    cutFrames: cutFrameData.map(cf => ({ segment: cf.segment, framePath: cf.path })),
    structureAnalysis,
  };

  // Save report
  const reportName = timestampedName('analysis', 'json');
  const reportPath = saveJSON(result, reportName);
  logger.success(`Analysis saved: ${reportPath}`);

  // Print summary
  logger.section('ANALYSIS SUMMARY');
  console.log(`Theme:        ${structureAnalysis.theme}`);
  console.log(`Summary:      ${structureAnalysis.content_summary}`);
  console.log(`Cuts:         ${cutSegments.length}`);
  console.log(`Style:        ${visionAnalysis.visual_style}`);
  console.log(`Color:        ${visionAnalysis.color_tone}`);
  console.log(`Audio lang:   ${audioAnalysis.language}`);
  console.log(`Transcript:   ${audioAnalysis.text.slice(0, 120)}`);

  return result;
}
