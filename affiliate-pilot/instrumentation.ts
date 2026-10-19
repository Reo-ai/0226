export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_SCHEDULER === "1") return;
  const { runScheduled } = await import("./lib/scheduler-run");
  // アプリを起動している間、1分ごとに定期実行のジョブを確認する
  setInterval(() => {
    runScheduled().catch((e) => console.error("scheduled job failed", e));
  }, 60_000);
}
