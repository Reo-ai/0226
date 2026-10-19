"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { CircleHelp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** g のあとに押すキーと移動先 */
const GO: Record<string, [string, string]> = {
  d: ["/", "ダッシュボード"],
  c: ["/coach", "AI司令塔"],
  k: ["/challenge", "初月5万円チャレンジ"],
  u: ["/academy", "攻略大学"],
  o: ["/offers", "案件分析"],
  w: ["/content", "コンテンツ工房"],
  j: ["/automation", "自動化センター"],
  a: ["/analytics", "収益分析"],
  s: ["/settings", "設定"],
};

const typing = (el: Element | null) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);

/** キーボード操作とヘルプ（? で開く） */
export function Hotkeys() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(document.activeElement)) return;
      if (e.key === "?") { e.preventDefault(); setOpen((v) => !v); return; }
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "g") { pendingG = Date.now(); return; }
      if (pendingG && Date.now() - pendingG < 1500 && GO[e.key]) {
        e.preventDefault();
        router.push(GO[e.key][0]);
      }
      pendingG = 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="使い方とキーボード操作（?キー）"><CircleHelp /></Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">使い方</Dialog.Title>
            <Dialog.Close aria-label="閉じる" className="rounded-md p-1.5 hover:bg-muted cursor-pointer"><X className="size-5" /></Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">毎日の流れは3つだけです。</Dialog.Description>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li><strong>ダッシュボード</strong>の「今日やること」を上から順に進める（作業可能時間内に収まっています）</li>
            <li>投稿や記事は<strong>コンテンツ工房</strong>で作り、公開前チェックを済ませてから自分で投稿する</li>
            <li>翌日、<strong>収益分析</strong>に表示回数・クリック・成果を記録する（分からない値は空欄でOK）</li>
          </ol>
          <h3 className="mt-5 text-sm font-bold">キーボード操作</h3>
          <p className="mt-1 text-xs text-muted-foreground">入力欄の外で押します。<kbd className="rounded border px-1">g</kbd> のあとに次のキーで画面を移動できます。</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(GO).map(([k, [, label]]) => (
              <div key={k} className="flex items-center gap-2"><kbd className="rounded border bg-muted px-1.5 font-mono text-xs">g {k}</kbd><span>{label}</span></div>
            ))}
            <div className="flex items-center gap-2"><kbd className="rounded border bg-muted px-1.5 font-mono text-xs">?</kbd><span>このヘルプ</span></div>
            <div className="flex items-center gap-2"><kbd className="rounded border bg-muted px-1.5 font-mono text-xs">Tab</kbd><span>次の項目へ（Enter で実行）</span></div>
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
