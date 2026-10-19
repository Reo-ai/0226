"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ClicksChart({ data }: { data: { label: string; clicks: number | null }[] }) {
  return (
    <div className="h-48 w-full" role="img" aria-label="日別クリック数の推移">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={16} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip formatter={(v) => (typeof v === "number" ? `${v}回` : "未計測")} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
          <Area dataKey="clicks" name="クリック" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
