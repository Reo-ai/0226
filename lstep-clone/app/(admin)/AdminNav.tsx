"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** 管理画面のメニュー。スマホでは「☰ メニュー」で開閉し、ページを移ったら自動で閉じる */
export default function AdminNav({ items, children }: { items: readonly (readonly [string, string])[]; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <nav className={`side${open ? " open" : ""}`}>
      <div className="side-head">
        <div className="brand">スキルコーチ・ステップ</div>
        <button type="button" className="ghost small side-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "✕ 閉じる" : "☰ メニュー"}
        </button>
      </div>
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
