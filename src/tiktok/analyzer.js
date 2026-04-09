import OpenAI from 'openai';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { imageToBase64 } from './downloader.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROMPT_MODEL = process.env.OPENAI_PROMPT_MODEL || 'gpt-4o';

/**
 * Analyze a single frame with GPT-4 Vision.
 */
export async function analyzeFrame(imagePath, prompt) {
  const base64 = imageToBase64(imagePath);
  const response = await openai.chat.completions.create({
    model: PROMPT_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
    max_tokens: 1000,
  });
  return response.choices[0].message.content;
}

/**
 * Analyze multiple frames for comprehensive visual analysis.
 */
export async function analyzeFrames(framePaths) {
  logger.step(`Analyzing ${framePaths.length} frames visually...`);

  const sampleFrames = framePaths.length > 6
    ? framePaths.filter((_, i) => i % Math.ceil(framePaths.length / 6) === 0).slice(0, 6)
    : framePaths;

  const content = [
    ...sampleFrames.map(fp => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${imageToBase64(fp)}`, detail: 'high' },
    })),
    {
      type: 'text',
      text: `Analyze these video frames from a TikTok video. Return a JSON object with:
{
  "subjects": ["main subjects/objects in the video"],
  "scene_description": "detailed description of the scene",
  "visual_style": "art style, cinematography style",
  "color_tone": "color palette and mood",
  "composition": "framing, angles, shot types",
  "motion_description": "how things move, camera movement",
  "hook_style": "how the video hooks viewers",
  "estimated_cuts": number
}
Return only valid JSON, no explanation.`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: PROMPT_MODEL,
    messages: [{ role: 'user', content }],
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Transcribe audio using OpenAI Whisper.
 */
export async function transcribeAudio(audioPath) {
  logger.step('Transcribing audio with Whisper...');
  const file = fs.createReadStream(audioPath);

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  return {
    text: transcription.text,
    segments: transcription.segments || [],
    language: transcription.language,
  };
}

/**
 * Analyze video structure and content with GPT.
 */
export async function analyzeStructure(visionAnalysis, audioAnalysis, cutSegments, duration) {
  logger.step('Analyzing overall structure...');

  const prompt = `You are analyzing a TikTok video. Based on the following data, provide a structured analysis.

Vision Analysis: ${JSON.stringify(visionAnalysis)}
Audio Transcript: ${audioAnalysis.text}
Audio Segments: ${JSON.stringify(audioAnalysis.segments?.slice(0, 10))}
Cut Segments: ${JSON.stringify(cutSegments)}
Duration: ${duration}s

Return a JSON object with:
{
  "theme": "main theme/topic of the video",
  "content_summary": "brief summary of content",
  "structure": {
    "cuts": [{"index": 0, "start": 0, "end": 5, "description": "what happens in this cut"}],
    "total_cuts": number,
    "pacing": "fast/medium/slow"
  },
  "style_elements": {
    "visual": "visual style notes",
    "audio": "music/sound style",
    "text_overlay": "any text/captions description"
  },
  "virality_factors": ["factor1", "factor2"],
  "reproduction_notes": "key elements to replicate for a similar video"
}
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: PROMPT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

/**
 * Generate TikTok trend analysis (without a specific URL).
 */
export async function analyzeTrends() {
  logger.step('Analyzing TikTok trends...');

  const response = await openai.chat.completions.create({
    model: PROMPT_MODEL,
    messages: [
      {
        role: 'user',
        content: `Analyze current TikTok trends. Provide:
1. Top trending content categories
2. Popular video formats and styles
3. Effective hook techniques
4. Audio/music trends
5. Recommended content ideas for high engagement

Format as a detailed analysis report in Japanese.`,
      },
    ],
    max_tokens: 2000,
  });

  return response.choices[0].message.content;
}
