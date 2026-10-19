"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isActive, MOBILE_NAV, NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => (MOBILE_NAV as readonly string[]).includes(n.href));
  return (
    <nav
      aria-label="下部メニュー"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-primary font-medium" : "text-muted-foreground")}>
                <Icon className="size-5" />
                {label.replace("ダッシュボード", "ホーム").replace("コンテンツ工房", "工房")}
              </Link>
            </li>
          );
        })}
        <li>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground cursor-pointer">
              <Menu className="size-5" />
              メニュー
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border bg-card p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>
                <div className="mb-3 flex items-center justify-between">
                  <Dialog.Title className="font-bold">メニュー</Dialog.Title>
                  <Dialog.Close aria-label="閉じる" className="rounded-md p-2 hover:bg-muted cursor-pointer"><X className="size-5" /></Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">すべての画面へのリンク</Dialog.Description>
                <ul className="grid grid-cols-2 gap-2">
                  {NAV.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-2 rounded-lg border p-3 text-sm", isActive(pathname, href) && "border-primary text-primary")}>
                        <Icon className="size-4" /> {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </li>
      </ul>
    </nav>
  );
}
