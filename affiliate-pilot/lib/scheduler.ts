import { z } from "zod";
import type { JobType } from "./automation";

/**
 * 定期実行（アプリ内のスケジューラー）。アプリを起動している間、1分ごとに「実行する時刻を過ぎたのに
 * まだ実行していないジョブ」を探して実行する。PCを閉じていた日は、次に起動したときに1回だけ実行する。
 */

export const scheduleSchema = z.object({
  enabled: z.boolean().default(true),
  dailyTasks: z.boolean().default(true),
  dailyTime: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  weeklyReport: z.boolean().default(true),
  improvement: z.boolean().default(true),
  /** 0=日曜 … 6=土曜 */
  weeklyDay: z.number().int().min(0).max(6).default(1),
  weeklyTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
});
export type Schedule = z.infer<typeof scheduleSchema>;
export const DEFAULT_SCHEDULE: Schedule = scheduleSchema.parse({});

/** 前回実行した期間（日なら YYYY-MM-DD、週なら その週の月曜の YYYY-MM-DD） */
export const lastRunsSchema = z.record(z.string(), z.string());
export type LastRuns = z.infer<typeof lastRunsSchema>;

const JST = 9 * 3_600_000;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** JST の日付・曜日・時刻（分） */
export function jstParts(now: Date) {
  const j = new Date(now.getTime() + JST);
  const day = j.toISOString().slice(0, 10);
  const dow = j.getUTCDay();
  const minutes = j.getUTCHours() * 60 + j.getUTCMinutes();
  const monday = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() - ((dow + 6) % 7))).toISOString().slice(0, 10);
  return { day, dow, minutes, week: monday };
}

/** 週の予定時刻（その週の月曜0時からの分） */
const weekMinutes = (dow: number, minutes: number) => ((dow + 6) % 7) * 1440 + minutes;

/** 今実行すべきジョブ（純粋関数）。firstWeek（使い始めた週）は、まだ振り返る記録がないので週次ジョブを動かさない */
export function dueJobs(s: Schedule, now: Date, last: LastRuns, firstWeek?: string): { type: JobType; period: string }[] {
  if (!s.enabled) return [];
  const t = jstParts(now);
  const out: { type: JobType; period: string }[] = [];
  if (s.dailyTasks && t.minutes >= minutesOf(s.dailyTime) && last.daily_tasks !== t.day) out.push({ type: "daily_tasks", period: t.day });
  const weeklyDue = t.week !== firstWeek && weekMinutes(t.dow, t.minutes) >= weekMinutes(s.weeklyDay, minutesOf(s.weeklyTime));
  if (weeklyDue && s.weeklyReport && last.weekly_report !== t.week) out.push({ type: "weekly_report", period: t.week });
  if (weeklyDue && s.improvement && last.improvement !== t.week) out.push({ type: "improvement", period: t.week });
  return out;
}

/** 次に実行される日時の説明（設定画面用） */
export function describeNext(s: Schedule, now: Date, last: LastRuns): { label: string; when: string }[] {
  if (!s.enabled) return [];
  const t = jstParts(now);
  const DOW = "日月火水木金土";
  const out: { label: string; when: string }[] = [];
  if (s.dailyTasks) {
    const when = last.daily_tasks === t.day ? `明日 ${s.dailyTime}` : t.minutes >= minutesOf(s.dailyTime) ? "まもなく（1分以内）" : `今日 ${s.dailyTime}`;
    out.push({ label: "日次タスク生成", when });
  }
  const weekly = `毎週${DOW[s.weeklyDay]}曜 ${s.weeklyTime}`;
  if (s.weeklyReport) out.push({ label: "週次レポート", when: weekly });
  if (s.improvement) out.push({ label: "改善案生成", when: weekly });
  return out;
}
