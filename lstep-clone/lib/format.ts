const TZ = "Asia/Tokyo";

export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("ja-JP", { timeZone: TZ });
}

/** JSTの日付キー (YYYY-MM-DD) */
export function jstDateKey(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
}

/** その時刻が属する日の0時(JST)のエポックms */
export function jstDayStart(ms: number): number {
  return Math.floor((ms + 9 * 3600_000) / 86_400_000) * 86_400_000 - 9 * 3600_000;
}

/** <input type="datetime-local"> の値をJSTとして解釈する */
export function parseJstLocal(value: string): number {
  return new Date(`${value}:00+09:00`).getTime();
}

export function fmtDelay(minutes: number, fixedTime = false): string {
  if (fixedTime) {
    const d = Math.floor(minutes / 1440);
    const t = minutes % 1440;
    const hhmm = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    return `${d === 0 ? "当日" : `${d}日後`}の${hhmm}`;
  }
  if (minutes === 0) return "即時";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}日`, h && `${h}時間`, m && `${m}分`].filter(Boolean).join("") + "後";
}

export function pct(n: number, d: number): string {
  if (!d) return "-";
  return `${((n / d) * 100).toFixed(1)}%`;
}

/** 今月1日0時(JST)のエポックms */
export function jstMonthStart(now = Date.now()): number {
  const d = new Date(now + 9 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 9 * 3600_000;
}

export function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
