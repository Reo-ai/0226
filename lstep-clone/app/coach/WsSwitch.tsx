"use client";

// 生徒管理ツールで見る公式LINEを切り替える
export default function WsSwitch({ current, list }: { current: string; list: { id: string; name: string }[] }) {
  return (
    <select
      className="coach-ws"
      value={current}
      aria-label="見る公式LINEを切り替える"
      onChange={(e) => (window.location.href = `/api/workspace/switch?ws=${e.target.value}&next=/coach`)}
    >
      {list.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
