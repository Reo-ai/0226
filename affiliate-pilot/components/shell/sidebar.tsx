"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV, SIMPLE_LABEL, SIMPLE_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** メニューの区切り（やる順番に並べる） */
const GROUPS: [string, readonly string[]][] = [
  ["はじめる", ["/", "/coach", "/roadmap", "/challenge"]],
  ["育てる", ["/accounts", "/accounts/assessment", "/academy"]],
  ["稼ぐ", ["/offers", "/content", "/automation", "/analytics"]],
  ["", ["/settings"]],
];

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" opacity=".55" />
      <path d="M16 5 L20 16 L16 27 L12 16 Z" fill="var(--primary)" />
      <path d="M5 16 L16 12 L27 16 L16 20 Z" fill="currentColor" opacity=".9" />
    </svg>
  );
}

export function Sidebar({ mode }: { mode: "simple" | "full" }) {
  const pathname = usePathname();
  const simple = mode === "simple";
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pb-5 pt-6">
        <Logo className="size-9 text-white" />
        <span>
          <span className="block text-base font-bold leading-tight tracking-wide text-white">Affiliate Pilot</span>
          <span className="text-[11px] opacity-75">AIアフィリエイト攻略司令塔</span>
        </span>
      </Link>
      <nav aria-label="メインメニュー" className="flex-1 overflow-y-auto px-3 pb-6">
        {simple && (
          <ul className="mb-4 flex flex-col gap-1">
            {SIMPLE_NAV.map(({ href, label }) => {
              const Icon = NAV.find((n) => n.href === href)!.icon;
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors hover:bg-white/8 hover:text-white", active && "bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_var(--primary)]")}>
                    <Icon className={cn("size-5", active && "text-primary")} />{label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {simple ? (
          <details className="group">
            <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-xs opacity-70 hover:bg-white/8 hover:opacity-100">▸ すべてのメニューを見る</summary>
            <Groups pathname={pathname} simple />
          </details>
        ) : (
          <Groups pathname={pathname} simple={false} />
        )}
      </nav>
      <p className="px-5 pb-4 text-[11px] opacity-50">PCで動く1人用アプリ</p>
    </aside>
  );
}

function Groups({ pathname, simple }: { pathname: string; simple: boolean }) {
  return (
    <>
        {GROUPS.map(([title, hrefs]) => (simple && !title) ? null : (
          <div key={title || "misc"} className="mb-4">
            {title && <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider opacity-60">{title}</p>}
            <ul className="flex flex-col gap-0.5">
              {hrefs.map((href) => {
                const item = NAV.find((n) => n.href === href)!;
                const Icon = item.icon;
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/8 hover:text-white",
                        active && "bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_var(--primary)]",
                      )}
                    >
                      <Icon className={cn("size-4", active && "text-primary")} />
                      {simple ? SIMPLE_LABEL[href] ?? item.label : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </>
  );
}
