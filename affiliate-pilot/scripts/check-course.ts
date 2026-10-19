// 講座データの検証: npx tsx scripts/check-course.ts asp
import { courseSchema } from "../lib/academy/schema";

async function main() {
  const id = process.argv[2];
  const mod = await import(`../lib/academy/courses/${id}.ts`);
  const r = courseSchema.safeParse(mod.default);
  if (!r.success) {
    console.error(r.error.issues.slice(0, 20).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1);
  }
  const c = r.data;
  const ids = new Set<string>();
  for (const l of c.lessons) {
    if (!l.id.startsWith(`${c.id}-`)) throw new Error(`レッスンID ${l.id} は ${c.id}- で始めてください`);
    if (ids.has(l.id)) throw new Error(`重複ID ${l.id}`);
    ids.add(l.id);
  }
  const chars = c.lessons.reduce((n, l) => n + JSON.stringify(l.body).length, 0);
  console.log(`OK ${c.id}: ${c.lessons.length}レッスン / 本文 ${chars}文字 / クイズ ${c.lessons.reduce((n, l) => n + l.quiz.length, 0)}問`);
}

main();
