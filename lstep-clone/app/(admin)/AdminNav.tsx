"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** 管理画面のメニュー。スマホでは「☰ メニュー」で開閉し、ページを移ったら自動で閉じる */
export default function AdminNav({
  items,
  children,
  workspaceName,
  workspaces = [],
  currentWs,
}: {
  items: readonly (readonly [string, string])[];
  children: React.ReactNode;
  workspaceName?: string;
  workspaces?: { id: string; name: string }[];
  currentWs?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <nav className={`side${open ? " open" : ""}`}>
      <div className="side-head">
        <div className="brand">スキルステップ</div>
        <button type="button" className="ghost small side-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "✕ 閉じる" : "☰ メニュー"}
        </button>
      </div>
      {workspaceName && (
        <div className="side-ws">
          {workspaces.length > 1 ? (
            <select
              value={currentWs}
              onChange={(e) => (window.location.href = `/api/workspace/switch?ws=${e.target.value}`)}
              aria-label="使う場所を切り替える"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <span>{workspaceName}</span>
          )}
        </div>
      )}
      <div className="side-links">
        {items.map(([href, label]) => (
          <Link key={href} href={href} className={path === href || path.startsWith(`${href}/`) ? "active" : undefined}>
            {label}
          </Link>
        ))}
        {children}
      </div>
    </nav>
  );
}
