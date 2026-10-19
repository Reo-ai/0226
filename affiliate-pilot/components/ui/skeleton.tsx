import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} />;
}

/** カード型の読み込み表示 */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      <Skeleton className="mb-4 h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cn("mb-2", i % 3 === 2 ? "w-2/3" : "w-full")} />)}
    </div>
  );
}
