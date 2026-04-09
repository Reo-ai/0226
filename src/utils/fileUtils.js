import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../');

export const DIRS = {
  images:  path.join(ROOT, 'output/images'),
  videos:  path.join(ROOT, 'output/videos'),
  reports: path.join(ROOT, 'output/reports'),
  tmp:     path.join(ROOT, 'output/.tmp'),
};

export function ensureDirs() {
  for (const dir of Object.values(DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveImage(base64Data, filename) {
  ensureDirs();
  const filepath = path.join(DIRS.images, filename);
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

export function saveVideo(buffer, filename) {
  ensureDirs();
  const filepath = path.join(DIRS.videos, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

export function saveReport(content, filename) {
  ensureDirs();
  const filepath = path.join(DIRS.reports, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

export function saveJSON(data, filename) {
  ensureDirs();
  const filepath = path.join(DIRS.reports, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  return filepath;
}

export function readJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

export function tmpPath(filename) {
  fs.mkdirSync(DIRS.tmp, { recursive: true });
  return path.join(DIRS.tmp, filename);
}

export function cleanTmp() {
  if (fs.existsSync(DIRS.tmp)) {
    fs.rmSync(DIRS.tmp, { recursive: true, force: true });
  }
}

export function slugify(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
}

export function timestampedName(prefix, ext) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}_${ts}.${ext}`;
}
