"use client";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";

export function ScoreRadar({ data }: { data: { label: string; score: number | null }[] }) {
  const rows = data.map((d) => ({ label: d.score === null ? `${d.label}（未計測）` : d.label, score: d.score ?? 0 }));
  return (
    <div className="h-64 w-full" role="img" aria-label={data.map((d) => `${d.label} ${d.score ?? "未計測"}`).join("、")}>
      <ResponsiveContainer>
        <RadarChart data={rows} outerRadius="70%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.25} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
