/** シンプルなCSVパーサ（ダブルクォート・カンマ・タブ区切りに対応） */
export function parseCsv(text: string): string[][] {
  const delim = text.split("\n")[0]?.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

/** ステータスの表記ゆれ（ASPごとに違う）を正規化 */
export function normalizeStatus(s: string): "pending" | "approved" | "rejected" {
  if (/承認|確定|approved|成果確定/i.test(s)) return "approved";
  if (/否認|却下|キャンセル|rejected|不承認/i.test(s)) return "rejected";
  return "pending";
}

/** "¥1,234" "1234円" などを数値に */
export function parseAmount(s: string): number {
  const n = Number(s.replace(/[¥￥,円\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
