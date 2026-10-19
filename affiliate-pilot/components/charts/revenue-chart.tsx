"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; pending: number | null; confirmed: number | null };

const yen = (v: unknown) => (typeof v === "number" ? `¥${Math.round(v).toLocaleString("ja-JP")}` : "未計測");

/** 発生報酬と確定報酬の棒グラフ。未計測（null）は棒を描かない */
export function RevenueChart({ data, height = 260 }: { data: Row[]; height?: number }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">この期間の記録はありません</p>;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`報酬の推移：${data.map((d) => `${d.label} 確定${yen(d.confirmed)}`).join("、")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={8} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 10000 ? `${v / 10000}万` : String(v))} />
          <Tooltip formatter={(v) => yen(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} cursor={{ fill: "var(--muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pending" name="発生報酬" fill="var(--chart-2)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="confirmed" name="確定報酬" fill="var(--chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
