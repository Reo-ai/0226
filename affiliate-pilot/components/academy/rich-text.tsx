import type { Block } from "@/lib/academy/schema";

/** **太字** だけを解釈する安全なテキスト描画（HTML は解釈しない） */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}

/** 目次用：見出しと、本文内のアンカー id */
export function headings(blocks: Block[]) {
  return blocks.flatMap((b, i) => (b.type === "h" ? [{ id: `h-${i}`, text: b.text.replace(/\*\*/g, "") }] : []));
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose-lesson">
      {blocks.map((b, i) => {
        if (b.type === "h") return <h3 key={i} id={`h-${i}`} className="scroll-mt-20"><Inline text={b.text} /></h3>;
        if (b.type === "p") return <p key={i}><Inline text={b.text} /></p>;
        const List = b.type === "ul" ? "ul" : "ol";
        return <List key={i}>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</List>;
      })}
    </div>
  );
}
