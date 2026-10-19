/** 用語の説明（「?」を押すと表示。JSなしでも動く） */
export const TERMS: Record<string, string> = {
  ctr: "CTR（クリック率）＝クリック数 ÷ 表示回数。見た人のうち、リンクを押した割合です。",
  cvr: "CVR（成約率）＝発生成約数 ÷ クリック数。リンクを押した人のうち、申し込みや購入をした割合です。",
  approval: "承認率＝承認された成約 ÷ 発生した成約。発生しても、条件を満たさないと「否認」になり報酬になりません。",
  pending: "発生報酬＝申し込みなどが起きた時点の報酬の見込み。まだ確定ではありません。",
  confirmed: "確定報酬＝広告主が承認して、支払いが決まった報酬。収入はこの数字で考えます。",
  paid: "入金額＝実際に口座に振り込まれた金額。確定から入金までは1〜2か月かかることがあります。",
  epc: "EPC＝1クリックあたりの確定報酬の見込み。案件を比べるときの物差しです。",
  impressions: "表示回数＝投稿や記事が画面に表示された回数（インプレッション・PV）。",
};

export function Term({ k, children }: { k: keyof typeof TERMS; children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <details className="relative inline-block">
        <summary aria-label="用語の説明" className="flex size-4 cursor-pointer list-none items-center justify-center rounded-full border text-[10px] text-muted-foreground hover:border-primary hover:text-primary">?</summary>
        <span className="absolute left-0 top-5 z-20 block w-64 rounded-lg border bg-card p-3 text-xs font-normal leading-relaxed text-foreground shadow-card">{TERMS[k]}</span>
      </details>
    </span>
  );
}
