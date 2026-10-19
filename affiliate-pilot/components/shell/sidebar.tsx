"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <Link href="/" className="px-5 pb-4 pt-6">
        <span className="block text-lg font-bold tracking-wide text-white">Affiliate Pilot AI</span>
        <span className="text-xs opacity-75">AIアフィリエイト攻略司令塔</span>
      </Link>
      <nav aria-label="メインメニュー" className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-white/8 hover:text-white",
                    active && "bg-white/10 font-medium text-white shadow-[inset_3px_0_0_var(--primary)]",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
