/** 小さな折れ線（サーバーで描画）。null は未計測として線を切る */
export function Sparkline({ values, color = "var(--chart-1)", width = 120, height = 32 }: { values: (number | null)[]; color?: string; width?: number; height?: number }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return <div style={{ width, height }} aria-hidden />;
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v === null) { open = false; return; }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    open = true;
  });
  const last = values.length - 1;
  const lastIdx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop() ?? last;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(lastIdx)} cy={y(values[lastIdx] as number)} r="2.5" fill={color} />
    </svg>
  );
}
