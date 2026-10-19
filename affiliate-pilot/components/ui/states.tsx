import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: { href: string; label: string }; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-8" />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <Link href={action.href} className={cn(buttonVariants({ size: "sm" }), "mt-2")}>{action.label}</Link>}
    </div>
  );
}

export function ErrorNote({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={cn("flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive", className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Notice({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return <div role="status" className={cn("rounded-lg border border-success/40 bg-success/10 p-3 text-sm", className)}>{message}</div>;
}

export function Spinner({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}
