#!/usr/bin/env node
/**
 * AI人物画像生成スクリプト
 * OpenAI DALL-E 3 で「成功の哲学」アカウント用の人物画像を生成します
 *
 * 使い方: node scripts/generate-avatar-image.js
 * 出力先: public/images/avatar.png
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// .envの読み込み
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY が設定されていません。.env ファイルを確認してください。');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPT = `
A confident Japanese man in his late 20s to early 30s,
looking directly at the camera with a calm and intelligent expression.
He is wearing a simple black t-shirt.
Background: minimalist modern apartment, soft morning light from large windows,
warm and clean atmosphere.
Vertical portrait orientation (9:16), upper body visible,
centered composition, photorealistic style, professional quality.
No text, no watermarks.
`.trim();

console.log('\n═══════════════════════════════════════════');
console.log('  成功の哲学 | AI人物画像生成');
console.log('═══════════════════════════════════════════');
console.log('  DALL-E 3 で人物画像を生成中...');
console.log('');

const response = await openai.images.generate({
  model:   'dall-e-3',
  prompt:  PROMPT,
  n:       1,
  size:    '1024x1792',  // 縦型（9:16に近い）
  quality: 'hd',
  style:   'natural',
});

const imageUrl = response.data[0].url;
console.log('✅ 画像生成完了！ダウンロード中...');

// 出力先ディレクトリを作成
const outputDir = path.join(ROOT, 'public/images');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'avatar.png');

// 画像をダウンロードして保存
await new Promise((resolve, reject) => {
  const file = fs.createWriteStream(outputPath);
  https.get(imageUrl, (res) => {
    res.pipe(file);
    file.on('finish', () => { file.close(); resolve(); });
  }).on('error', reject);
});

console.log(`✅ 保存完了: ${outputPath}`);
console.log('');
console.log('次のステップ:');
console.log('  npm run remotion:studio でプレビューを確認してください');
console.log('  画像が気に入らない場合はもう一度実行すると別の画像が生成されます');
console.log('');
