import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

/**
 * 指標のタイル。前の期間との差（delta: 0〜1 の比率、null なら比較不能）と、小さな推移グラフを出せる。
 * 色は状態を表すときだけ使う（増えたら良い指標は up を good に）。
 */
export function KpiTile({ label, value, delta, deltaLabel = "前期間比", spark, sparkColor, hint, className }: {
  label: string; value: string; delta?: number | null; deltaLabel?: string; spark?: (number | null)[]; sparkColor?: string; hint?: string; className?: string;
}) {
  const d = delta ?? null;
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card min-w-0", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {spark && <Sparkline values={spark} color={sparkColor} width={72} height={24} />}
      </div>
      <p className="tabular mt-1 text-xl font-bold leading-tight">{value}</p>
      {d !== null ? (
        <p className={cn("mt-1 flex items-center gap-0.5 text-xs", d > 0.005 ? "text-success" : d < -0.005 ? "text-destructive" : "text-muted-foreground")}>
          {d > 0.005 ? <ArrowUpRight className="size-3.5" /> : d < -0.005 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
          {d > 0 ? "+" : ""}{(d * 100).toFixed(0)}% <span className="text-muted-foreground">{deltaLabel}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
