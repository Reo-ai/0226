import Link from "next/link";
import { toggleGuide } from "@/lib/actions";
import { guideState } from "@/lib/guide";

export default async function GuidePage() {
  const steps = await guideState();
  const done = steps.filter((s) => s.done).length;
  const phases = [...new Set(steps.map((s) => s.phase))];

  return (
    <>
      <h1>攻略ガイド</h1>
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>進捗 {done} / {steps.length}</strong>
          <span className="hint">データから判定できるステップは自動でチェックされます</span>
        </div>
        <div className="meter"><div style={{ width: `${(done / steps.length) * 100}%`, height: "100%", background: "var(--accent)" }} /></div>
      </div>
      {phases.map((phase) => (
        <div key={phase} className="panel">
          <h2>{phase}</h2>
          <ul className="steps" style={{ padding: 0, margin: 0 }}>
            {steps.filter((s) => s.phase === phase).map((s) => (
              <li key={s.id} className={s.done ? "done" : ""}>
                <form action={toggleGuide} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <input type="hidden" name="step" value={s.id} />
                  <input type="hidden" name="done" value={s.done ? "0" : "1"} />
                  <button className={`small ${s.done ? "" : "ghost"}`} disabled={s.autoDone} title={s.autoDone ? "自動判定で完了" : ""}>
                    {s.done ? "✓" : "□"}
                  </button>
                  <div>
                    <div className="title"><strong>{s.title}</strong> {s.href && <Link href={s.href} className="hint">→ 開く</Link>}</div>
                    <div className="hint" style={{ marginTop: 4 }}>{s.body}</div>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
