/** CSV/TSV パーサ（ダブルクォート・カンマ・タブ区切り、BOM 対応） */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delim = (text.split("\n")[0] ?? "").includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

/** 1行目をヘッダーとして、ヘッダー名（別名あり）→ 値 のオブジェクト配列にする */
export function csvObjects(input: string, aliases: Record<string, string[]>): { rows: Record<string, string>[]; unknownHeaders: string[] } {
  const [header, ...body] = parseCsv(input);
  if (!header) return { rows: [], unknownHeaders: [] };
  const norm = (s: string) => s.replace(/\s|（.*?）|\(.*?\)/g, "").toLowerCase();
  const keys = header.map((h) => Object.entries(aliases).find(([, names]) => names.some((n) => norm(n) === norm(h)))?.[0] ?? null);
  return {
    rows: body.map((r) => Object.fromEntries(keys.flatMap((k, i) => (k ? [[k, r[i] ?? ""]] : [])))),
    unknownHeaders: header.filter((_, i) => keys[i] === null),
  };
}

/** 表計算ソフトで数式として実行されないよう、危険な先頭文字の文字列セルを無害化する */
export function safeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // Excel で文字化けしないよう BOM を付ける
  return "﻿" + [header.map(safeCell).join(","), ...rows.map((r) => r.map(safeCell).join(","))].join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
