#!/usr/bin/env node
/**
 * ナレーション音声生成スクリプト
 * 使い方: node scripts/generate-narration.js [--voice onyx] [--speed 1.1]
 *
 * 出力先: output/audio/post01_narration.mp3
 * この mp3 は Remotion の public/audio/ にもコピーされます
 */

import { program } from 'commander';
import { generatePost01Narration } from '../src/pipeline/narratorGenerator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

program
  .option('--voice <voice>', '音声タイプ (onyx/echo/nova/shimmer/alloy/fable)', 'onyx')
  .option('--speed <speed>', '読み上げ速度 (0.25〜4.0)', '1.1')
  .parse();

const opts = program.opts();
const speed = parseFloat(opts.speed);

console.log('\n═══════════════════════════════════════════');
console.log('  成功の哲学 | Post #01 ナレーション生成');
console.log('═══════════════════════════════════════════');
console.log(`  voice: ${opts.voice}, speed: ${speed}x`);
console.log('');

const audioPath = await generatePost01Narration({ voice: opts.voice, speed });

// Remotion の public ディレクトリにもコピー（staticFile() で参照できるように）
const publicAudioDir = path.join(ROOT, 'public/audio');
fs.mkdirSync(publicAudioDir, { recursive: true });
const destPath = path.join(publicAudioDir, 'post01_narration.mp3');
fs.copyFileSync(audioPath, destPath);

console.log(`\n✅ Remotion public にコピー完了: ${destPath}`);
console.log('');
console.log('次のステップ: bash scripts/render-post01.sh でレンダリング開始');
console.log('');
