import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { ROOT } from '../utils/fileUtils.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 利用可能な音声一覧
 *
 * 男性系:
 *   onyx   → 深くて落ち着いた声（成功の哲学に最適）
 *   echo   → ナレーター風・中性的
 *
 * 女性系:
 *   nova   → 明るく親しみやすい
 *   shimmer → 柔らかく知的
 *
 * その他:
 *   alloy  → 中性的・バランス型
 *   fable  → 物語系・表現豊か
 */

const NARRATION_POST01 = `成功者と普通の人の朝、何が違うか知ってる？

まず一つ目。成功者は起きた瞬間にスマホを見ない。
代わりに、たった5分間だけ、今日何をするかを頭の中で整理する。
これだけで午前中の集中力が全然変わる。

二つ目。必ず体を動かす。ジムじゃなくていい。10分で十分。
朝に体を動かすと、脳の覚醒スイッチが入って判断力が上がる。

三つ目。起きてすぐ水を500ミリリットル飲む。
寝ている間に失った水分を補うだけで、頭のもやがスッと消える。

この3つ、めちゃくちゃ地味でしょ？
でも習慣って、積み重なると1年後の自分が全然違う人間になってる。
成功の哲学って、結局これなんです。

明日の朝から一個だけ試してみて。
保存して毎朝見返してね。`;

/**
 * OpenAI TTS でナレーション音声を生成する
 *
 * @param {string} text - 読み上げるテキスト
 * @param {object} options
 * @param {string} [options.voice='onyx'] - 音声タイプ
 * @param {number} [options.speed=1.1]   - 読み上げ速度（0.25〜4.0）
 * @param {string} [options.filename]    - 出力ファイル名
 * @param {string} [options.model='tts-1-hd'] - TTSモデル（tts-1 or tts-1-hd）
 * @returns {string} 保存したファイルの絶対パス
 */
export async function generateNarration(text, options = {}) {
  const {
    voice    = 'onyx',
    speed    = 1.1,
    filename = `narration_${Date.now()}.mp3`,
    model    = 'tts-1-hd',
  } = options;

  const audioDir = path.join(ROOT, 'output/audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const outputPath = path.join(audioDir, filename);

  logger.step(`ナレーション生成中 (voice: ${voice}, speed: ${speed}x)...`);

  const response = await openai.audio.speech.create({
    model,
    voice,
    input: text,
    speed,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  logger.success(`ナレーション保存: ${outputPath}`);
  return outputPath;
}

/**
 * 1投稿目「成功者の朝習慣」のナレーションを生成する
 *
 * @param {object} options
 * @param {string} [options.voice='onyx'] - 音声タイプ
 * @param {number} [options.speed=1.1]   - 読み上げ速度
 * @returns {string} 保存したファイルの絶対パス
 */
export async function generatePost01Narration(options = {}) {
  return generateNarration(NARRATION_POST01, {
    voice:    options.voice    ?? 'onyx',
    speed:    options.speed    ?? 1.1,
    filename: 'post01_narration.mp3',
    model:    'tts-1-hd',
  });
}

export { NARRATION_POST01 };
