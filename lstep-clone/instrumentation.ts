export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_INTERNAL_CRON === "1") return;
  const { runDueJobs } = await import("./lib/jobs");
  // 自前サーバー運用時: 1分ごとにステップ配信・予約配信を処理
  setInterval(() => {
    runDueJobs().catch((e) => console.error("job failed", e));
  }, 60_000);
}
