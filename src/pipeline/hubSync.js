import { logger } from '../utils/logger.js';
import { THEME_IDS } from '../config/themes.js';
import { runReel } from './reelPipeline.js';

// affiliate-hub の投稿の型 → このパイプラインのコンテンツタイプ
const KIND_TO_TYPE = {
  review: 'review',
  compare: 'educational',
  howto: 'educational',
  story: 'story',
  hook: 'hook',
};

function hubConfig() {
  const url = (process.env.HUB_URL || '').replace(/\/$/, '');
  const token = process.env.HUB_TOKEN || '';
  if (!url || !token) throw new Error('HUB_URL と HUB_TOKEN を .env に設定してください');
  return { url, token };
}

async function hubFetch(path, init = {}) {
  const { url, token } = hubConfig();
  const res = await fetch(`${url}/api/pipeline${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`affiliate-hub ${res.status}: ${await res.text()}`);
  return res.json();
}

async function report(id, status, result) {
  await hubFetch('', { method: 'POST', body: JSON.stringify({ id, status, result }) });
}

/**
 * affiliate-hub で「動画にする」を押された投稿を取りに行き、リール生成して結果を返す。
 *
 * @param {object} opts
 * @param {number} [opts.limit=3] - 1回に処理する件数
 * @param {string} [opts.imageModel='gemini']
 * @param {number} [opts.duration=30]
 * @param {string} [opts.account]
 * @returns {number} 処理した件数
 */
export async function syncOnce(opts = {}) {
  const { jobs } = await hubFetch(`?limit=${opts.limit ?? 3}`);
  if (jobs.length === 0) {
    logger.info('affiliate-hub: 待ちジョブなし');
    return 0;
  }
  for (const job of jobs) {
    logger.section(`JOB #${job.id}: ${job.program?.name ?? ''} (${job.theme}, ${job.service})`);
    try {
      if (!THEME_IDS.includes(job.theme)) throw new Error(`未知のテーマ: ${job.theme}`);
      const r = await runReel(job.theme, {
        type: KIND_TO_TYPE[job.kind] ?? 'educational',
        product: job.program?.name,
        script: job.body,
        caption: job.body,
        service: job.service === 'none' ? 'sora' : job.service,
        skipVideo: job.service === 'none',
        imageModel: opts.imageModel,
        duration: opts.duration,
        account: opts.account,
      });
      const failed = job.service !== 'none' && r.videoPaths.length === 0;
      await report(job.id, failed ? 'failed' : 'done', {
        title: r.concept.title,
        hook: r.concept.hook,
        imagePath: r.imagePath,
        videoPaths: r.videoPaths,
        summaryPath: r.summaryPath,
        error: failed ? r.videoErrors.join(' / ') || '動画生成に失敗しました' : undefined,
      });
    } catch (err) {
      logger.error(`JOB #${job.id} failed: ${err.message}`);
      await report(job.id, 'failed', { error: err.message }).catch((e) => logger.error(`報告失敗: ${e.message}`));
    }
  }
  return jobs.length;
}
