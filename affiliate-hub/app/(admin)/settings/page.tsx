import { saveSettings } from "@/lib/actions";
import { AI_MODELS, aiConfig, aiMonthlyUsage } from "@/lib/ai";
import { yen } from "@/lib/format";
import { Notice, type SP } from "@/lib/ui";

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const { notice } = await searchParams;
  const cfg = await aiConfig();
  const usage = await aiMonthlyUsage();

  return (
    <>
      <h1>設定</h1>
      <Notice notice={notice} />
      <div className="panel">
        <div className="row">
          <span className={`badge ${process.env.ANTHROPIC_API_KEY ? "on" : ""}`}>
            ANTHROPIC_API_KEY {process.env.ANTHROPIC_API_KEY ? "設定済み" : "未設定"}
          </span>
          <span>今月のAI利用: {usage.count}回（約{yen(usage.jpy)}）</span>
        </div>
      </div>
      <form action={saveSettings} className="panel stack">
        <label className="stack">
          AIモデル
          <select name="ai_model" defaultValue={cfg.model}>
            {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="stack">
          月間のAI利用回数の上限（0で無制限）
          <input type="number" name="ai_monthly_limit" min="0" defaultValue={cfg.monthlyLimit} style={{ width: 120 }} />
        </label>
        <label className="stack">
          発信者プロフィール（AIリサーチ・投稿生成で使われます）
          <textarea name="profile" defaultValue={cfg.profile} placeholder="例: 30代会社員。TikTok @xxx（フォロワー2,000）で筋トレ×時短を発信。口調はフランク。実際に使っている商品: 〇〇プロテイン、△△アプリ" />
        </label>
        <div><button>保存</button></div>
      </form>
    </>
  );
}
