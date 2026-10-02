"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, guestViewEnabled, requireAuth, setGuestSession } from "./auth";
import { sendBroadcast } from "./broadcasts";
import { validateContent } from "./content";
import { batch, get, run, setSetting } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { parseFields } from "./forms";
import { fmtDateTime as formatJst, parseJstLocal } from "./format";
import { getFriend, getFriendByToken, targetFriends } from "./friends";
import {
  clearDefaultRichMenu,
  createRichMenu as lineCreateRichMenu,
  deleteRichMenu as lineDeleteRichMenu,
  setDefaultRichMenu,
  uploadRichMenuImage,
} from "./line";
import { assertPushQuota, QuotaError } from "./quota";
import { buildDefinition, layoutOf, syncRichMenuForTag } from "./richmenu";
import { enroll } from "./scenarios";
import { addTag, removeTag } from "./tags";
import type { Broadcast, Form, FormField, RichMenu, RichMenuArea } from "./types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0);
const optId = (fd: FormData, k: string) => num(fd, k) || null;
const enc = encodeURIComponent;

// ---- auth ----
export async function startGuestView() {
  if (!guestViewEnabled()) redirect("/login");
  await setGuestSession();
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

// ---- friends ----
export async function sendManual(fd: FormData) {
  await requireAuth();
  const friend = await getFriend(num(fd, "friendId"));
  const content = str(fd, "content");
  if (!friend) return;
  const path = `/friends/${friend.id}`;
  const err = validateContent(content);
  if (err) redirect(`${path}?error=${enc(err)}`);
  if (str(fd, "mode") === "reply") {
    await queuePending([friend.id], [{ content, source: "manual", refId: null }]);
  } else {
    try {
      await pushToFriend(friend, content, "manual");
    } catch (e) {
      if (e instanceof QuotaError) redirect(`${path}?error=${enc(e.message)}`);
      throw e;
    }
  }
  revalidatePath(path);
  redirect(path);
}

export async function cancelPending(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM pending_messages WHERE id = ?", num(fd, "id"));
  revalidatePath(`/friends/${num(fd, "friendId")}`);
}

export async function toggleFriendAi(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  await run("UPDATE friends SET ai_enabled = 1 - ai_enabled WHERE id = ?", id);
  revalidatePath(`/friends/${id}`);
}

export async function saveFriendNote(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  await run("UPDATE friends SET note = ? WHERE id = ?", str(fd, "note"), id);
  revalidatePath(`/friends/${id}`);
}

export async function addFriendTag(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  const tagId = num(fd, "tagId");
  if (tagId) await addTag(id, tagId);
  revalidatePath(`/friends/${id}`);
}

export async function removeFriendTag(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  await removeTag(id, num(fd, "tagId"));
  revalidatePath(`/friends/${id}`);
}

export async function enrollFriend(fd: FormData) {
  await requireAuth();
  const id = num(fd, "friendId");
  const scenarioId = num(fd, "scenarioId");
  if (scenarioId) await enroll(id, scenarioId);
  revalidatePath(`/friends/${id}`);
}

export async function stopEnrollment(fd: FormData) {
  await requireAuth();
  await run("UPDATE enrollments SET status = 'stopped', next_run_at = NULL WHERE id = ?", num(fd, "enrollmentId"));
  revalidatePath(`/friends/${num(fd, "friendId")}`);
}

// ---- tags ----
export async function createTag(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name");
  if (name) await run("INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)", name, str(fd, "color") || "#06c755");
  revalidatePath("/tags");
}

export async function deleteTag(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM friend_tags WHERE tag_id = ?", args: [id] },
    { sql: "UPDATE auto_replies SET add_tag_id = NULL WHERE add_tag_id = ?", args: [id] },
    { sql: "UPDATE links SET add_tag_id = NULL WHERE add_tag_id = ?", args: [id] },
    { sql: "UPDATE forms SET add_tag_id = NULL WHERE add_tag_id = ?", args: [id] },
    { sql: "UPDATE sources SET add_tag_id = NULL WHERE add_tag_id = ?", args: [id] },
    { sql: "UPDATE rich_menus SET tag_id = NULL WHERE tag_id = ?", args: [id] },
    { sql: "UPDATE scenarios SET trigger_tag_id = NULL, enabled = 0 WHERE trigger_tag_id = ?", args: [id] },
    { sql: "DELETE FROM tags WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/tags");
}

// ---- broadcasts ----
export async function createBroadcast(fd: FormData) {
  await requireAuth();
  const content = str(fd, "content");
  const err = validateContent(content);
  if (err) redirect(`/broadcasts/new?error=${enc(err)}`);
  const tagIds = fd.getAll("tagIds").map(Number).filter(Boolean);
  const delivery = str(fd, "delivery") === "reply" ? "reply" : "push";
  const when = str(fd, "scheduledAt");
  const scheduledAt = str(fd, "mode") === "schedule" && when ? parseJstLocal(when) : Date.now();
  const now = scheduledAt <= Date.now();

  if (now && delivery === "push") {
    try {
      await assertPushQuota((await targetFriends(tagIds)).length);
    } catch (e) {
      if (e instanceof QuotaError) redirect(`/broadcasts/new?error=${enc(e.message)}`);
      throw e;
    }
  }
  const { lastId } = await run(
    "INSERT INTO broadcasts (title, content, tag_ids, delivery, status, scheduled_at, created_at) VALUES (?, ?, ?, ?, 'scheduled', ?, ?)",
    str(fd, "title") || content.slice(0, 20),
    content,
    JSON.stringify(tagIds),
    delivery,
    scheduledAt,
    Date.now(),
  );
  if (now) await sendBroadcast((await get<Broadcast>("SELECT * FROM broadcasts WHERE id = ?", lastId))!);
  revalidatePath("/broadcasts");
  redirect("/broadcasts");
}

export async function cancelBroadcast(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  const b = await get<Broadcast>("SELECT * FROM broadcasts WHERE id = ?", id);
  if (b?.status === "scheduled") {
    await run("UPDATE broadcasts SET status = 'canceled' WHERE id = ?", id);
  } else if (b?.delivery === "reply" && b.status === "sent") {
    // 無料配信の未配達分を取り消し
    await run("DELETE FROM pending_messages WHERE source = 'broadcast' AND ref_id = ?", id);
    await run("UPDATE broadcasts SET status = 'canceled' WHERE id = ?", id);
  }
  revalidatePath("/broadcasts");
}

// ---- scenarios ----
export async function createScenario(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name");
  if (!name) return;
  const trigger = str(fd, "trigger") as "follow" | "tag" | "manual";
  const { lastId } = await run(
    "INSERT INTO scenarios (name, trigger, trigger_tag_id, stop_tag_id, created_at) VALUES (?, ?, ?, ?, ?)",
    name,
    trigger,
    trigger === "tag" ? optId(fd, "triggerTagId") : null,
    optId(fd, "stopTagId"),
    Date.now(),
  );
  redirect(`/scenarios/${lastId}`);
}

export async function setScenarioStopTag(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await run("UPDATE scenarios SET stop_tag_id = ? WHERE id = ?", optId(fd, "stopTagId"), id);
  revalidatePath(`/scenarios/${id}`);
}

export async function toggleScenario(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await run("UPDATE scenarios SET enabled = 1 - enabled WHERE id = ?", id);
  revalidatePath(`/scenarios/${id}`);
  revalidatePath("/scenarios");
}

export async function deleteScenario(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM enrollments WHERE scenario_id = ?", args: [id] },
    { sql: "DELETE FROM scenario_steps WHERE scenario_id = ?", args: [id] },
    { sql: "DELETE FROM scenarios WHERE id = ?", args: [id] },
  ]);
  redirect("/scenarios");
}

export async function addStep(fd: FormData) {
  await requireAuth();
  const scenarioId = num(fd, "scenarioId");
  const content = str(fd, "content");
  const err = validateContent(content);
  if (err) redirect(`/scenarios/${scenarioId}?error=${enc(err)}`);
  const fixedTime = str(fd, "timing") === "fixed";
  const delay = fixedTime
    ? num(fd, "days") * 1440 + Math.min(23, num(fd, "atHour")) * 60 + Math.min(59, num(fd, "atMinute"))
    : num(fd, "days") * 1440 + num(fd, "hours") * 60 + num(fd, "minutes");
  await run(
    "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, fixed_time, content) VALUES (?, ?, ?, ?, ?)",
    scenarioId,
    Math.max(0, delay),
    str(fd, "delivery") === "reply" ? "reply" : "push",
    fixedTime ? 1 : 0,
    content,
  );
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function deleteStep(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM scenario_steps WHERE id = ?", num(fd, "id"));
  revalidatePath(`/scenarios/${num(fd, "scenarioId")}`);
}

// ---- auto replies ----
export async function createAutoReply(fd: FormData) {
  await requireAuth();
  const keyword = str(fd, "keyword");
  const reply = str(fd, "reply");
  const err = validateContent(reply);
  if (err) redirect(`/auto-replies?error=${enc(err)}`);
  if (keyword) {
    await run(
      "INSERT INTO auto_replies (keyword, match_type, reply, add_tag_id) VALUES (?, ?, ?, ?)",
      keyword,
      str(fd, "matchType") === "contains" ? "contains" : "exact",
      reply,
      optId(fd, "addTagId"),
    );
  }
  revalidatePath("/auto-replies");
}

export async function toggleAutoReply(fd: FormData) {
  await requireAuth();
  await run("UPDATE auto_replies SET enabled = 1 - enabled WHERE id = ?", num(fd, "id"));
  revalidatePath("/auto-replies");
}

export async function deleteAutoReply(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM auto_replies WHERE id = ?", num(fd, "id"));
  revalidatePath("/auto-replies");
}

// ---- links ----
export async function createLink(fd: FormData) {
  await requireAuth();
  const url = str(fd, "url");
  if (!/^https?:\/\//.test(url)) return;
  const code = str(fd, "code").replace(/[^\w-]/g, "") || crypto.randomBytes(4).toString("hex");
  await run(
    "INSERT OR IGNORE INTO links (code, name, url, add_tag_id, created_at) VALUES (?, ?, ?, ?, ?)",
    code,
    str(fd, "name") || url,
    url,
    optId(fd, "addTagId"),
    Date.now(),
  );
  revalidatePath("/links");
}

export async function deleteLink(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM link_clicks WHERE link_id = ?", args: [id] },
    { sql: "DELETE FROM links WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/links");
}

// ---- rich menus ----
export async function createRichMenu(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name") || "メニュー";
  const chatBarText = str(fd, "chatBarText") || "メニュー";
  const layout = layoutOf(str(fd, "layout"));
  const image = fd.get("image");
  if (!(image instanceof File) || image.size === 0) redirect(`/rich-menus?error=${enc("画像を選択してください")}`);
  if (!["image/png", "image/jpeg"].includes(image.type)) redirect(`/rich-menus?error=${enc("画像はPNGかJPEGにしてください")}`);
  if (image.size > 1024 * 1024) redirect(`/rich-menus?error=${enc("画像は1MB以下にしてください")}`);

  const areas: RichMenuArea[] = Array.from({ length: layout.cols * layout.rows }, (_, i) => ({
    type: (str(fd, `area${i}_type`) || "none") as RichMenuArea["type"],
    value: str(fd, `area${i}_value`),
  }));
  const data = new Uint8Array(await image.arrayBuffer());
  let lineId: string | null = null;
  try {
    lineId = await lineCreateRichMenu(buildDefinition(name, chatBarText, layout.key, areas));
    if (lineId) await uploadRichMenuImage(lineId, data, image.type);
  } catch (e) {
    redirect(`/rich-menus?error=${enc(`LINEへの登録に失敗しました: ${String(e)}`)}`);
  }
  const tagId = optId(fd, "tagId");
  await run(
    `INSERT INTO rich_menus (name, chat_bar_text, layout, areas, image_data, line_rich_menu_id, tag_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    name,
    chatBarText,
    layout.key,
    JSON.stringify(areas),
    `data:${image.type};base64,${Buffer.from(data).toString("base64")}`,
    lineId ?? (process.env.LINE_CHANNEL_ACCESS_TOKEN ? null : `dry-run-${Date.now()}`),
    tagId,
    Date.now(),
  );
  if (tagId) await syncRichMenuForTag(tagId);
  revalidatePath("/rich-menus");
  redirect("/rich-menus");
}

export async function setDefaultMenu(fd: FormData) {
  await requireAuth();
  const menu = await get<RichMenu>("SELECT * FROM rich_menus WHERE id = ?", num(fd, "id"));
  if (!menu?.line_rich_menu_id) return;
  if (menu.is_default) {
    await clearDefaultRichMenu();
    await run("UPDATE rich_menus SET is_default = 0");
  } else {
    await setDefaultRichMenu(menu.line_rich_menu_id);
    await batch([
      { sql: "UPDATE rich_menus SET is_default = 0", args: [] },
      { sql: "UPDATE rich_menus SET is_default = 1 WHERE id = ?", args: [menu.id] },
    ]);
  }
  revalidatePath("/rich-menus");
}

export async function deleteRichMenu(fd: FormData) {
  await requireAuth();
  const menu = await get<RichMenu>("SELECT * FROM rich_menus WHERE id = ?", num(fd, "id"));
  if (!menu) return;
  if (menu.line_rich_menu_id && !menu.line_rich_menu_id.startsWith("dry-run")) {
    await lineDeleteRichMenu(menu.line_rich_menu_id).catch((e) => console.error(e));
  }
  await batch([
    { sql: "UPDATE friends SET rich_menu_id = NULL WHERE rich_menu_id = ?", args: [menu.id] },
    { sql: "DELETE FROM rich_menus WHERE id = ?", args: [menu.id] },
  ]);
  revalidatePath("/rich-menus");
}

// ---- forms ----
export async function saveForm(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  const title = str(fd, "title");
  const fields = parseFields(str(fd, "fields"));
  if (!title || fields.length === 0) redirect(`/forms${id ? `/${id}` : ""}?error=${enc("タイトルと項目を入力してください")}`);
  const values = [title, str(fd, "description"), JSON.stringify(fields), optId(fd, "addTagId"), str(fd, "thanks")];
  if (id) {
    await run(
      "UPDATE forms SET title = ?, description = ?, fields = ?, add_tag_id = ?, thanks_message = ? WHERE id = ?",
      ...values,
      id,
    );
    revalidatePath(`/forms/${id}`);
    redirect(`/forms/${id}`);
  }
  const { lastId } = await run(
    "INSERT INTO forms (title, description, fields, add_tag_id, thanks_message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ...values,
    Date.now(),
  );
  redirect(`/forms/${lastId}`);
}

export async function deleteForm(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM form_responses WHERE form_id = ?", args: [id] },
    { sql: "DELETE FROM forms WHERE id = ?", args: [id] },
  ]);
  redirect("/forms");
}

/** 公開フォームの送信（ログイン不要） */
export async function submitForm(fd: FormData) {
  const form = await get<Form>("SELECT * FROM forms WHERE id = ?", num(fd, "formId"));
  if (!form) return;
  const token = str(fd, "f");
  const friend = token ? await getFriendByToken(token) : undefined;
  const fields = JSON.parse(form.fields) as FormField[];
  const answers: Record<string, string> = {};
  for (const [i, f] of fields.entries()) {
    const v =
      f.type === "checkbox"
        ? fd.getAll(`q${i}`).map(String).filter((o) => f.options.includes(o)).join(", ")
        : str(fd, `q${i}`).slice(0, 5000);
    if (f.required && !v) {
      redirect(`/f/${form.id}?${new URLSearchParams({ ...(token ? { f: token } : {}), error: `「${f.label}」は必須です` })}`);
    }
    answers[f.label] = v;
  }
  await run(
    "INSERT INTO form_responses (form_id, friend_id, answers, created_at) VALUES (?, ?, ?, ?)",
    form.id,
    friend?.id ?? null,
    JSON.stringify(answers),
    Date.now(),
  );
  if (friend && form.add_tag_id) await addTag(friend.id, form.add_tag_id);
  redirect(`/f/${form.id}/thanks`);
}

// ---- sources ----
export async function createSource(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name");
  if (!name) return;
  const code = str(fd, "code").replace(/[^\w-]/g, "") || crypto.randomBytes(4).toString("hex");
  await run(
    "INSERT OR IGNORE INTO sources (code, name, add_tag_id, created_at) VALUES (?, ?, ?, ?)",
    code,
    name,
    optId(fd, "addTagId"),
    Date.now(),
  );
  revalidatePath("/sources");
}

export async function deleteSource(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM source_visits WHERE source_id = ?", args: [id] },
    { sql: "UPDATE friends SET source_id = NULL WHERE source_id = ?", args: [id] },
    { sql: "DELETE FROM sources WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/sources");
}

// ---- settings ----
export async function saveSettings(fd: FormData) {
  await requireAuth();
  await setSetting("ai_enabled", fd.get("aiEnabled") ? "1" : "0");
  await setSetting("ai_model", str(fd, "aiModel"));
  await setSetting("ai_monthly_limit", String(Math.max(0, num(fd, "aiMonthlyLimit"))));
  await setSetting("ai_system_prompt", str(fd, "aiSystemPrompt"));
  await setSetting("ai_knowledge", str(fd, "aiKnowledge"));
  await setSetting("push_limit", String(Math.max(0, num(fd, "pushLimit"))));
  revalidatePath("/settings");
  redirect(`/settings?saved=${enc(formatJst(Date.now()))}`);
}
