const TZ = "Asia/Tokyo";
const DAY = 86_400_000;
const JST = 9 * 3_600_000;

export function yen(n: number | null | undefined): string {
  if (n === null || n === undefined) return "未計測";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "未計測";
  return Math.round(n).toLocaleString("ja-JP");
}

/** 比率（0〜1）を%表示。null は「計算不能」 */
export function pct(r: number | null | undefined, digits = 1): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "—";
  return `${(r * 100).toFixed(digits)}%`;
}

export function fmtDate(d: Date | number | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { timeZone: TZ });
}

export function fmtDateTime(d: Date | number | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ja-JP", { timeZone: TZ });
}

/** JSTの日付キー YYYY-MM-DD */
export function dateKey(d: Date | number): string {
  return new Date(new Date(d).getTime() + JST).toISOString().slice(0, 10);
}

/** JST のその日 0 時 */
export function jstDay(d: Date | number = Date.now()): Date {
  const t = new Date(d).getTime();
  return new Date(t - ((t + JST) % DAY + DAY) % DAY);
}

/** YYYY-MM-DD または YYYY/M/D を JST 0 時として解釈。不正なら null */
export function parseDateKey(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return new Date(t - JST);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((jstDay(b).getTime() - jstDay(a).getTime()) / DAY);
}

/** JST の月初 0 時 */
export function jstMonthStart(d: Date | number = Date.now()): Date {
  const j = new Date(new Date(d).getTime() + JST);
  return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - JST);
}

/** JST の週初（月曜）0 時 */
export function jstWeekStart(d: Date | number = Date.now()): Date {
  const day = jstDay(d);
  const dow = new Date(day.getTime() + JST).getUTCDay(); // 0=日
  return addDays(day, -((dow + 6) % 7));
}

export function minutesLabel(m: number): string {
  if (m < 60) return `${m}分`;
  return m % 60 ? `${Math.floor(m / 60)}時間${m % 60}分` : `${m / 60}時間`;
}
