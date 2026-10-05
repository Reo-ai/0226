// 5分ごとに本番の /api/cron を呼ぶだけの Worker
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.APP_URL}/api/cron`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } }).then(async (r) => {
        if (!r.ok) console.error("cron failed", r.status, (await r.text()).slice(0, 200));
      }),
    );
  },
};
