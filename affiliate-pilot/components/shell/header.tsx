import { Bell, Bot } from "lucide-react";
import Link from "next/link";
import { activeProvider } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { Breadcrumbs } from "./breadcrumbs";
import { Hotkeys } from "./hotkeys";
import { ThemeToggle } from "./theme-toggle";

const PROVIDER_LABEL = { ollama: "ローカルAI", claude: "Claude", fallback: "AIなし" } as const;

export async function Header() {
  const [status, recs, jobs, drafts] = await Promise.all([
    activeProvider(),
    prisma.aIRecommendation.count({ where: { status: "open" } }),
    prisma.automationJob.count({ where: { status: "awaiting_review" } }),
    prisma.contentDraft.count({ where: { status: "awaiting_review" } }),
  ]);
  const pending = recs + jobs + drafts;
  return (
    <header
      className="sticky z-30 flex h-14 items-center gap-2 border-b bg-background/90 backdrop-blur"
      style={{ top: "env(safe-area-inset-top, 0px)", paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}
    >
      <Link href="/" className="font-bold lg:hidden">Pilot</Link>
      <div className="hidden min-w-0 flex-1 lg:block"><Breadcrumbs /></div>
      <div className="flex-1 lg:hidden" />
      <Link
        href="/settings#ai"
        title={status.message}
        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
      >
        <span className={`size-2 rounded-full ${status.provider === "fallback" ? "bg-warning" : "bg-success"}`} aria-hidden />
        <Bot className="size-3.5" />
        <span>{PROVIDER_LABEL[status.provider]}</span>
        <span className="sr-only">：{status.message}</span>
      </Link>
      <Link href="/automation" aria-label={`通知 ${pending}件`} className="relative rounded-md p-2 hover:bg-muted">
        <Bell className="size-5" />
        {pending > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {pending > 99 ? "99+" : pending}
          </span>
        )}
      </Link>
      <Hotkeys />
      <ThemeToggle />
    </header>
  );
}
