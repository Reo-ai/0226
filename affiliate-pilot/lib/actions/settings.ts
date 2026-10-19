"use server";

import { revalidatePath } from "next/cache";
import { aiConfigSchema, healthAll } from "../ai";
import { isAllowedOllamaUrl } from "../ai/ollama";
import { importAll } from "../backup";
import { clearDemo, loadDemo } from "../demo";
import { requireProfile } from "../profile";
import { setSetting } from "../settings";
import { type ActionState, firstIssue, formObject } from "./form";

export async function saveAiConfig(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const raw = formObject(fd);
  const p = aiConfigSchema.safeParse({ ...raw, timeoutSec: Number(raw.timeoutSec) });
  if (!p.success) return { error: firstIssue(p.error) };
  if (p.data.ollamaBaseUrl && !isAllowedOllamaUrl(p.data.ollamaBaseUrl)) return { error: "Ollama の接続先は、このPC（localhost）か同じLAN内のアドレスにしてください" };
  if (!/^[\w.:/-]{1,80}$/.test(p.data.ollamaModel)) return { error: "モデル名の形式が正しくありません" };
  await setSetting("ai", p.data);
  revalidatePath("/", "layout");
  return { ok: "AIの設定を保存しました" };
}

export type HealthState = { results: { provider: string; ok: boolean; message: string; models?: string[] }[] } | null;

export async function testConnection(): Promise<HealthState> {
  await requireProfile();
  return { results: await healthAll() };
}

export async function restoreBackup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "バックアップファイル（.json）を選んでください" };
  if (file.size > 50 * 1024 * 1024) return { error: "ファイルが大きすぎます（50MBまで）" };
  if (fd.get("confirm") !== "yes") return { error: "「現在のデータを置き換える」にチェックを入れてください" };
  try {
    const n = await importAll(JSON.parse(await file.text()));
    revalidatePath("/", "layout");
    return { ok: `復元しました（${n}件）` };
  } catch (e) {
    return { error: e instanceof SyntaxError ? "JSONとして読み込めませんでした" : e instanceof Error ? e.message : "復元に失敗しました" };
  }
}

export async function loadDemoAction(): Promise<ActionState> {
  const profile = await requireProfile();
  await loadDemo(profile.id);
  revalidatePath("/", "layout");
  return { ok: "サンプルデータを入れました（「サンプル」と表示されます）" };
}

export async function clearDemoAction(): Promise<ActionState> {
  await requireProfile();
  await clearDemo();
  revalidatePath("/", "layout");
  return { ok: "サンプルデータを削除しました" };
}
