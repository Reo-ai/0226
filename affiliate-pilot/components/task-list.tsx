import { CircleCheck, Circle, Clock, SkipForward } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { setTaskStatus } from "@/lib/actions/tasks";
import { minutesLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; description: string; priority: number; estimatedMinutes: number; status: string; relatedFeature: string; source: string };

const SOURCE: Record<string, string> = { rule: "ルール", ai: "AI", manual: "手動", challenge: "チャレンジ", roadmap: "ロードマップ" };

export function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {tasks.map((t) => {
        const done = t.status === "done";
        const skipped = t.status === "skipped";
        return (
          <li key={t.id} className="flex items-start gap-3 py-3">
            <form action={setTaskStatus}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="status" value={done ? "todo" : "done"} />
              <button type="submit" aria-label={done ? `「${t.title}」を未完了に戻す` : `「${t.title}」を完了にする`} className="mt-0.5 rounded-full text-primary cursor-pointer">
                {done ? <CircleCheck className="size-6" /> : <Circle className="size-6 text-muted-foreground hover:text-primary" />}
              </button>
            </form>
            <div className={cn("min-w-0 flex-1", (done || skipped) && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("font-medium", done && "line-through")}>{t.title}</span>
                {t.priority <= 1 && !done && <Badge variant="default">最優先</Badge>}
                {skipped && <Badge variant="outline">見送り</Badge>}
              </div>
              {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="size-3" />{minutesLabel(t.estimatedMinutes)}</span>
                <span>{SOURCE[t.source] ?? t.source}</span>
                {t.relatedFeature && !done && <Link href={t.relatedFeature} className="font-medium text-primary hover:underline">作業する →</Link>}
              </div>
            </div>
            {!done && !skipped && (
              <form action={setTaskStatus}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="status" value="skipped" />
                <button type="submit" aria-label={`「${t.title}」を今日は見送る`} title="今日は見送る" className="rounded p-1 text-muted-foreground hover:bg-muted cursor-pointer"><SkipForward className="size-4" /></button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
