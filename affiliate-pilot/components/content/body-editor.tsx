"use client";
import { CircleCheck, Eye, PencilLine, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/input";
import { lintContent } from "@/lib/content-lint";
import { cn } from "@/lib/utils";

/** 本文の編集欄。文字数・PR表記・注意表現をその場で表示し、プレビューに切り替えられる */
export function BodyEditor({ id, name, defaultValue, platform }: { id: string; name: string; defaultValue: string; platform: string }) {
  const [text, setText] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const lint = useMemo(() => lintContent(text), [text]);
  const chars = text.replace(/\s/g, "").length;
  const limit = platform === "x" ? 140 : null;
  const firstPost = platform === "x" ? (text.split(/\n\s*\n/)[0] ?? "").replace(/^【[^】]*】\s*/, "").length : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="tabular text-muted-foreground">{chars.toLocaleString("ja-JP")}文字（空白を除く）</span>
        {limit !== null && firstPost !== null && (
          <span className={cn("tabular", firstPost > limit ? "text-destructive" : "text-muted-foreground")}>最初の投稿 {firstPost}/{limit}字</span>
        )}
        <span className={cn("flex items-center gap-1", lint.adDisclosure ? "text-success" : "text-destructive")}>
          {lint.adDisclosure ? <CircleCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
          {lint.adDisclosure ? "PR表記あり" : "PR表記なし"}
        </span>
        {lint.issues.length > 0 && <span className="flex items-center gap-1 text-warning"><TriangleAlert className="size-3.5" />注意表現 {lint.issues.length}件</span>}
        <button type="button" onClick={() => setPreview((v) => !v)} className="ml-auto flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted cursor-pointer" aria-pressed={preview}>
          {preview ? <PencilLine className="size-3.5" /> : <Eye className="size-3.5" />}{preview ? "編集に戻る" : "プレビュー"}
        </button>
      </div>
      {/* 送信用の値は常に textarea に持たせ、プレビュー中は非表示にする */}
      <Textarea id={id} name={name} value={text} onChange={(e) => setText(e.target.value)} className={cn("min-h-96 font-mono text-[13px] leading-relaxed", preview && "hidden")} />
      {preview && (
        <div className="min-h-96 whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-relaxed" aria-label="プレビュー">
          {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
        </div>
      )}
      {lint.issues.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-warning">{lint.issues.map((x) => <li key={x}>{x}</li>)}</ul>
      )}
    </div>
  );
}
