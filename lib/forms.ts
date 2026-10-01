import type { FormField } from "./types";

const TYPES = ["text", "textarea", "select", "radio", "checkbox", "email", "tel"] as const;

/**
 * フォーム項目の簡易記法（1行1項目）:
 *   ラベル | 種類 | 選択肢1,選択肢2 | 必須
 * 種類: text, textarea, select, radio, checkbox, email, tel（省略時 text）
 */
export function parseFields(src: string): FormField[] {
  return src
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, type = "text", options = "", req = ""] = line.split("|").map((s) => s.trim());
      return {
        label,
        type: (TYPES as readonly string[]).includes(type) ? (type as FormField["type"]) : "text",
        options: options ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
        required: req === "必須" || req.toLowerCase() === "required",
      };
    })
    .filter((f) => f.label);
}

export function stringifyFields(fields: FormField[]): string {
  return fields
    .map((f) => [f.label, f.type, f.options.join(","), f.required ? "必須" : ""].join(" | ").replace(/( \| )+$/, ""))
    .join("\n");
}

export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  // Excelで文字化けしないようBOM付き
  return "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}
