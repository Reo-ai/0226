const TZ = "Asia/Tokyo";

export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("ja-JP", { timeZone: TZ });
}

export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleDateString("ja-JP", { timeZone: TZ });
}

/** JSTの日付キー (YYYY-MM-DD) */
export function jstDateKey(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD（または YYYY/MM/DD）をJSTの0時として解釈する。不正なら NaN */
export function parseJstDate(value: string): number {
  const m = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 9 * 3600_000;
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

/** 今日0時(JST)のエポックms */
export function jstDayStart(now = Date.now()): number {
  return now - ((now + 9 * 3600_000) % 86_400_000);
}

export function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
