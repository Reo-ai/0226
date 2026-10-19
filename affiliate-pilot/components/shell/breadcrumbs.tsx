"use client";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEGMENT_LABEL } from "@/lib/nav";

/** 動的セグメント（講座ID等）のラベルはページから渡す */
export function Breadcrumbs({ labels = {} }: { labels?: Record<string, string> }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return <span className="text-sm font-medium">ダッシュボード</span>;
  return (
    <nav aria-label="パンくずリスト" className="min-w-0">
      <ol className="flex items-center gap-1 overflow-hidden text-sm text-muted-foreground">
        <li><Link href="/" className="hover:text-foreground">ホーム</Link></li>
        {parts.map((p, i) => {
          const href = "/" + parts.slice(0, i + 1).join("/");
          // 攻略大学の講座ID・レッスンIDは各ページ内に名前を出すので、ここでは種類だけ表示する
          const label = labels[p] ?? SEGMENT_LABEL[p] ?? (parts[0] === "academy" ? (i === 1 ? "講座" : "レッスン") : parts[1] === "asp" && i === 2 ? "ASP攻略" : decodeURIComponent(p));
          const last = i === parts.length - 1;
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0" />
              {last ? <span className="truncate font-medium text-foreground" aria-current="page">{label}</span> : <Link href={href} className="truncate hover:text-foreground">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
