"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canCreateWorkspaces, clearSession, guestViewEnabled, requireAuth, requireOwner, sessionUser, setGuestSession, setWorkspaceCookie, workspacesOf } from "./auth";
import { sendBroadcast } from "./broadcasts";
import { validateContent } from "./content";
import { batch, get, mainGet, mainRun, run, setSetting } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { parseFields } from "./forms";
import { fmtDateTime as formatJst, parseJstLocal } from "./format";
import { getFriend, getFriendByToken, targetFriends } from "./friends";
import { baseUrl } from "./env";
import { adminLineIds, issueStatelessToken, lineConfig, saveLineConfig } from "./lineConfig";
import {
  clearDefaultRichMenu,
  fetchBotInfo,
  hasToken,
  setupWebhook,
  createRichMenu as lineCreateRichMenu,
  deleteRichMenu as lineDeleteRichMenu,
  setDefaultRichMenu,
  upsertRichMenuAlias,
  uploadRichMenuImage,
} from "./line";
import { assertPushQuota, QuotaError } from "./quota";
import { action as richAction, buildDefinition, layoutOf, syncRichMenuForTag } from "./richmenu";
import { enroll } from "./scenarios";
import { addTag, removeTag } from "./tags";
import type { Broadcast, Form, FormField, RichMenu, RichMenuArea } from "./types";
import { currentWorkspace, MAIN, runInWorkspace, withWs } from "./workspace";
import { createInvite, deleteWorkspace } from "./invites";
import { saveAnswersToFields, setFieldValue } from "./fields";
import { segmentFriends, segmentFrom } from "./segment";
import { clearNeedsReply, issueNotifyCode, removeNotifyTarget } from "./inbox";
import { installTemplate } from "./templates";
import { claimByLineKeys, ClaimError } from "./claim";
import { pendingName } from "./loginFlow";
import { REPORT_ENABLED, REPORT_TIME } from "./report";
import { STRIPE_SECRET_KEY, STRIPE_THANKS_KEY } from "./stripe";
import { addScore, changeScore } from "./score";
import { book, BOOKING_SETTINGS, BookingError, cancelBooking, createSlots } from "./bookings";

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
  await clearNeedsReply(friend.id);
  revalidatePath(path);
  redirect(path);
}

/** 未返信の一覧から「対応済み」にする */
export async function markReplied(fd: FormData) {
  await requireAuth();
  await clearNeedsReply(num(fd, "friendId"));
  revalidatePath("/inbox");
  revalidatePath(`/friends/${num(fd, "friendId")}`);
}

/** 通知を受け取る LINE を登録するためのコードを出す */
export async function issueNotifyCodeAction() {
  await requireOwner();
  await issueNotifyCode();
  revalidatePath("/settings");
}

export async function removeNotifyTargetAction(fd: FormData) {
  await requireOwner();
  await removeNotifyTarget(num(fd, "friendId"));
  revalidatePath("/settings");
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
  await requireOwner();
  const name = str(fd, "name");
  if (name) await run("INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)", name, str(fd, "color") || "#06c755");
  revalidatePath("/tags");
}

export async function deleteTag(fd: FormData) {
  await requireOwner();
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
  await requireOwner();
  const content = str(fd, "content");
  const err = validateContent(content);
  if (err) redirect(`/broadcasts/new?error=${enc(err)}`);
  const segment = segmentFrom(
    (k) => (fd.get(k) as string | null) ?? null,
    (k) => fd.getAll(k).map(String),
  );
  const delivery = str(fd, "delivery") === "reply" ? "reply" : "push";
  const when = str(fd, "scheduledAt");
  const scheduledAt = str(fd, "mode") === "schedule" && when ? parseJstLocal(when) : Date.now();
  const now = scheduledAt <= Date.now();

  if (now && delivery === "push") {
    try {
      await assertPushQuota((await segmentFriends(segment)).length);
    } catch (e) {
      if (e instanceof QuotaError) redirect(`/broadcasts/new?error=${enc(e.message)}`);
      throw e;
    }
  }
  const title = str(fd, "title") || content.slice(0, 20);
  const contentB = str(fd, "contentB");
  if (contentB) {
    const errB = validateContent(contentB);
    if (errB) redirect(`/broadcasts/new?error=${enc(`B案：${errB}`)}`);
  }
  // A/Bテスト：A案・B案の2件を同じ組で作り、送る時に友だちを半分ずつに分ける
  const group = contentB ? Date.now() % 1_000_000 : null;
  const ids: number[] = [];
  for (const [variant, body] of contentB ? ([["A", content], ["B", contentB]] as const) : ([[null, content]] as const)) {
    const { lastId } = await run(
      "INSERT INTO broadcasts (title, content, tag_ids, delivery, status, scheduled_at, created_at, ab_group, ab_variant) VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)",
      variant ? `${title}（${variant}案）` : title,
      body,
      JSON.stringify(segment),
      delivery,
      scheduledAt,
      Date.now(),
      group,
      variant,
    );
    ids.push(lastId);
  }
  if (now) for (const id of ids) await sendBroadcast((await get<Broadcast>("SELECT * FROM broadcasts WHERE id = ?", id))!);
  revalidatePath("/broadcasts");
  redirect("/broadcasts");
}

export async function cancelBroadcast(fd: FormData) {
  await requireOwner();
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
  await requireOwner();
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
  await requireOwner();
  const id = num(fd, "id");
  await run("UPDATE scenarios SET stop_tag_id = ? WHERE id = ?", optId(fd, "stopTagId"), id);
  revalidatePath(`/scenarios/${id}`);
}

export async function toggleScenario(fd: FormData) {
  await requireOwner();
  const id = num(fd, "id");
  await run("UPDATE scenarios SET enabled = 1 - enabled WHERE id = ?", id);
  revalidatePath(`/scenarios/${id}`);
  revalidatePath("/scenarios");
}

export async function deleteScenario(fd: FormData) {
  await requireOwner();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM enrollments WHERE scenario_id = ?", args: [id] },
    { sql: "DELETE FROM scenario_steps WHERE scenario_id = ?", args: [id] },
    { sql: "DELETE FROM scenarios WHERE id = ?", args: [id] },
  ]);
  redirect("/scenarios");
}

export async function addStep(fd: FormData) {
  await requireOwner();
  const scenarioId = num(fd, "scenarioId");
  const content = str(fd, "content");
  const err = validateContent(content);
  if (err) redirect(`/scenarios/${scenarioId}?error=${enc(err)}`);
  const fixedTime = str(fd, "timing") === "fixed";
  const delay = fixedTime
    ? num(fd, "days") * 1440 + Math.min(23, num(fd, "atHour")) * 60 + Math.min(59, num(fd, "atMinute"))
    : num(fd, "days") * 1440 + num(fd, "hours") * 60 + num(fd, "minutes");
  const condTagId = optId(fd, "condTagId");
  const condType = condTagId && ["has", "not"].includes(str(fd, "condType")) ? str(fd, "condType") : null;
  await run(
    "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, fixed_time, content, cond_tag_id, cond_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
    scenarioId,
    Math.max(0, delay),
    str(fd, "delivery") === "reply" ? "reply" : "push",
    fixedTime ? 1 : 0,
    content,
    condType ? condTagId : null,
    condType,
  );
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function deleteStep(fd: FormData) {
  await requireOwner();
  await run("DELETE FROM scenario_steps WHERE id = ?", num(fd, "id"));
  revalidatePath(`/scenarios/${num(fd, "scenarioId")}`);
}

// ---- auto replies ----
export async function createAutoReply(fd: FormData) {
  await requireOwner();
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
  await requireOwner();
  await run("UPDATE auto_replies SET enabled = 1 - enabled WHERE id = ?", num(fd, "id"));
  revalidatePath("/auto-replies");
}

export async function deleteAutoReply(fd: FormData) {
  await requireOwner();
  await run("DELETE FROM auto_replies WHERE id = ?", num(fd, "id"));
  revalidatePath("/auto-replies");
}

// ---- links ----
export async function createLink(fd: FormData) {
  await requireOwner();
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
  await requireOwner();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM link_clicks WHERE link_id = ?", args: [id] },
    { sql: "DELETE FROM links WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/links");
}

// ---- rich menus ----
export async function createRichMenu(fd: FormData) {
  await requireOwner();
  const name = str(fd, "name") || "メニュー";
  const chatBarText = str(fd, "chatBarText") || "メニュー";
  const layout = layoutOf(str(fd, "layout"));
  // 自分の画像があればそれを、なければ画面で作った画像（ボタンの文字から描いたもの）を使う
  let image = fd.get("image");
  if (!(image instanceof File) || image.size === 0) {
    const gen = str(fd, "generatedImage").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!gen) redirect(`/rich-menus?error=${enc("ボタンの文字を入れるか、画像を選んでください")}`);
    image = new File([Buffer.from(gen[1], "base64")], "menu.jpg", { type: "image/jpeg" });
  }
  if (!["image/png", "image/jpeg"].includes(image.type)) redirect(`/rich-menus?error=${enc("画像はPNGかJPEGにしてください")}`);
  if (image.size > 1024 * 1024) redirect(`/rich-menus?error=${enc("画像は1MB以下にしてください")}`);

  const areas: RichMenuArea[] = Array.from({ length: layout.cols * layout.rows }, (_, i) => {
    const type = (str(fd, `area${i}_type`) || "none") as RichMenuArea["type"];
    // 「テキスト送信」で送る文字が空なら、ボタンの文字（先頭の絵文字を除く）を送る
    const label = str(fd, `area${i}_label`).replace(/^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*\s*/u, "");
    return { type, value: str(fd, `area${i}_value`) || (type === "message" ? label : "") };
  });
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
    lineId ?? ((await hasToken()) ? null : `dry-run-${Date.now()}`),
    tagId,
    Date.now(),
  );
  if (tagId) await syncRichMenuForTag(tagId);
  revalidatePath("/rich-menus");
  redirect("/rich-menus");
}

export async function setDefaultMenu(fd: FormData) {
  await requireOwner();
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
  await requireOwner();
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
  await requireOwner();
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
  await requireOwner();
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
      redirect(withWs(`/f/${form.id}?${new URLSearchParams({ ...(token ? { f: token } : {}), error: `「${f.label}」は必須です` })}`, await currentWorkspace()));
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
  // 質問名が友だち情報欄の項目名と同じなら、その友だちの情報として保存する
  if (friend) await saveAnswersToFields(friend.id, answers);
  await addScore(friend?.id, "form", form.id);
  redirect(withWs(`/f/${form.id}/thanks`, await currentWorkspace()));
}

// ---- sources ----
export async function createSource(fd: FormData) {
  await requireOwner();
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
  await requireOwner();
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
  await requireOwner();
  await setSetting("ai_enabled", fd.get("aiEnabled") ? "1" : "0");
  await setSetting("ai_model", str(fd, "aiModel"));
  await setSetting("ai_monthly_limit", String(Math.max(0, num(fd, "aiMonthlyLimit"))));
  await setSetting("ai_system_prompt", str(fd, "aiSystemPrompt"));
  await setSetting("ai_knowledge", str(fd, "aiKnowledge"));
  await setSetting("push_limit", String(Math.max(0, num(fd, "pushLimit"))));
  revalidatePath("/settings");
  redirect(`/settings?saved=${enc(formatJst(Date.now()))}`);
}

// ---- LINE連携（公式LINEの値を画面から登録） ----
export async function saveLineConnection(_: string | null, fd: FormData): Promise<string | null> {
  await requireOwner();
  const current = await lineConfig();
  const channelId = str(fd, "channelId") || current.channelId;
  const channelSecret = str(fd, "channelSecret") || current.channelSecret;
  if (!channelId || !channelSecret) return "Channel ID と Channel secret を入力してください";
  let token: string;
  try {
    token = await issueStatelessToken(channelId, channelSecret);
  } catch {
    return "Channel ID か Channel secret が違います。公式LINEの管理画面「設定 → Messaging API」の値をそのままコピーしてください";
  }
  const info = await fetchBotInfo(token);
  await saveLineConfig({
    channelId,
    channelSecret,
    accessToken: current.accessToken,
    basicId: info.basicId,
    displayName: info.displayName,
    pictureUrl: info.pictureUrl ?? "",
  });
  // 同じ公式LINEの鍵でログインした人を、この場所に入れられるように記録しておく
  if ((await currentWorkspace()) !== MAIN) await mainRun("UPDATE workspaces SET line_basic_id = ? WHERE id = ?", info.basicId, await currentWorkspace());
  try {
    // ワークスペースごとの受信先（main は従来どおり /api/line/webhook）
    const ws = await currentWorkspace();
    const test = await setupWebhook(token, `${baseUrl()}/api/line/webhook${ws === MAIN ? "" : `/${ws}`}`);
    if (!test.success) return `連携は保存しましたが、LINEからの受信確認に失敗しました（${test.reason ?? "理由不明"}）`;
  } catch (e) {
    return `連携は保存しましたが、受信先（Webhook）の設定に失敗しました: ${(e as Error).message}`;
  }
  revalidatePath("/", "layout");
  redirect("/line?ok=1");
}

// ---- 習慣トラッカー用のリッチメニュー（「できた」「記録」「習慣」の3ボタン）をワンクリックで作って既定にする ----
export async function createHabitMenu() {
  await requireOwner();
  const res = await fetch(`${baseUrl()}/richmenu/habit.jpg`);
  if (!res.ok) redirect(`/rich-menus?error=${enc("メニュー画像を読み込めませんでした")}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const areas: RichMenuArea[] = [
    { type: "message", value: "できた" },
    { type: "message", value: "記録" },
    { type: "message", value: "習慣" },
  ];
  let lineId: string | null = null;
  try {
    lineId = await lineCreateRichMenu(buildDefinition("習慣トラッカー", "メニュー", "half-3", areas));
    if (lineId) {
      await uploadRichMenuImage(lineId, data, "image/jpeg");
      await setDefaultRichMenu(lineId);
    }
  } catch (e) {
    redirect(`/rich-menus?error=${enc(`LINEへの登録に失敗しました: ${String(e)}`)}`);
  }
  await run("UPDATE rich_menus SET is_default = 0");
  await run(
    `INSERT INTO rich_menus (name, chat_bar_text, layout, areas, image_data, line_rich_menu_id, tag_id, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
    "習慣トラッカー",
    "メニュー",
    "half-3",
    JSON.stringify(areas),
    `data:image/jpeg;base64,${Buffer.from(data).toString("base64")}`,
    lineId ?? `dry-run-${Date.now()}`,
    Date.now(),
  );
  revalidatePath("/rich-menus");
  redirect("/rich-menus");
}

// ---- タブで切り替える2つのメニュー（A：冒険メニュー＋できた／B：習慣メニュー） ----
const TAB_H = 260;
type Box = { x: number; y: number; width: number; height: number };
const switchTo = (alias: string) => ({ type: "richmenuswitch", richMenuAliasId: alias, data: `switch=${alias}` });

export async function createTabMenus() {
  await requireOwner();
  // A の下半分は、今の「通常メニュー（タグなし）」のボタンをそのまま使う
  const base = await get<RichMenu>(
    "SELECT * FROM rich_menus WHERE tag_id IS NULL AND layout = 'full-6' ORDER BY id LIMIT 1",
  );
  if (!base) redirect(`/rich-menus?error=${enc("元になる通常メニュー（大・6分割）が見つかりません")}`);
  const baseAreas = JSON.parse(base.areas) as RichMenuArea[];

  // 冒険メニュー：上のタブ（冒険／できた／習慣へ）＋ 元の6分割を画面いっぱいに並べた画像
  //（画像は funnels/claude-code-course/assets/richmenu-tab-course.html から書き出す）
  const unit = (2500 - 44 - 28) / 2.8;
  const tabsA: [Box, object][] = [
    // 表示中のタブは押しても何も送らない（会話の邪魔をしない）
    [{ x: 0, y: 0, width: Math.round(22 + unit), height: TAB_H }, { type: "postback", data: "tab=adventure" }],
    [{ x: Math.round(22 + unit), y: 0, width: Math.round(14 + unit * 0.8), height: TAB_H }, { type: "message", text: "できた" }],
    [{ x: Math.round(36 + unit * 1.8), y: 0, width: 2500 - Math.round(36 + unit * 1.8), height: TAB_H }, switchTo("habit")],
  ];
  const cellW = 2500 / 3;
  const cellH = (1686 - TAB_H) / 2;
  const bodyA: [Box, object][] = [];
  baseAreas.forEach((a, i) => {
    const act = richAction(a);
    if (!act) return;
    const c = i % 3;
    const r = Math.floor(i / 3);
    const x0 = Math.round(c * cellW);
    const x1 = c === 2 ? 2500 : Math.round((c + 1) * cellW);
    bodyA.push([{ x: x0, y: Math.round(TAB_H + r * cellH), width: x1 - x0, height: Math.round(cellH) }, act]);
  });

  // 習慣メニュー：上のタブ（冒険へ／習慣）＋ 3つの大きなボタン
  const third = Math.round(2500 / 3);
  const tabsB: [Box, object][] = [[{ x: 0, y: 0, width: 1250, height: TAB_H }, switchTo("adventure")]];
  const bodyB: [Box, object][] = (["できた", "記録", "習慣"] as const).map((text, i) => [
    { x: i * third, y: TAB_H, width: i === 2 ? 2500 - 2 * third : third, height: 1686 - TAB_H },
    { type: "message", text },
  ]);

  const def = (name: string, areas: [Box, object][]) => ({
    size: { width: 2500, height: 1686 },
    selected: true,
    name,
    chatBarText: "メニュー",
    areas: areas.map(([bounds, action]) => ({ bounds, action })),
  });

  const images: Record<string, Uint8Array> = {};
  for (const f of ["tab-course", "tab-habit"]) {
    const res = await fetch(`${baseUrl()}/richmenu/${f}.jpg`);
    if (!res.ok) redirect(`/rich-menus?error=${enc("メニュー画像を読み込めませんでした")}`);
    images[f] = new Uint8Array(await res.arrayBuffer());
  }

  let idA: string | null = null;
  let idB: string | null = null;
  try {
    idA = await lineCreateRichMenu(def("冒険メニュー（タブ）", [...tabsA, ...bodyA]));
    idB = await lineCreateRichMenu(def("習慣メニュー（タブ）", [...tabsB, ...bodyB]));
    if (idA && idB) {
      await uploadRichMenuImage(idA, images["tab-course"], "image/jpeg");
      await uploadRichMenuImage(idB, images["tab-habit"], "image/jpeg");
      await upsertRichMenuAlias("adventure", idA);
      await upsertRichMenuAlias("habit", idB);
      await setDefaultRichMenu(idA);
    }
  } catch (e) {
    redirect(`/rich-menus?error=${enc(`LINEへの登録に失敗しました: ${String(e)}`)}`);
  }
  const now = Date.now();
  const row = (name: string, img: Uint8Array, lineId: string | null, isDefault: number) => ({
    sql: `INSERT INTO rich_menus (name, chat_bar_text, layout, areas, image_data, line_rich_menu_id, tag_id, is_default, created_at)
          VALUES (?, 'メニュー', 'full-1', '[]', ?, ?, NULL, ?, ?)`,
    args: [name, `data:image/jpeg;base64,${Buffer.from(img).toString("base64")}`, lineId ?? `dry-run-${now}`, isDefault, now],
  });
  await batch([
    { sql: "UPDATE rich_menus SET is_default = 0", args: [] },
    row("冒険メニュー（タブ・A）", images["tab-course"], idA, 1),
    row("習慣メニュー（タブ・B）", images["tab-habit"], idB, 0),
  ]);
  revalidatePath("/rich-menus");
  redirect("/rich-menus");
}

// ---- 招待（内海さん＝main の管理者だけが発行できる） ----
async function requireInviter(): Promise<string> {
  const user = await sessionUser();
  if (!user || !(await canCreateWorkspaces(user))) redirect("/login");
  return user;
}

export async function createInviteAction(fd: FormData) {
  const user = await requireInviter();
  await createInvite(user, str(fd, "note"));
  revalidatePath("/invites");
}

export async function revokeInvite(fd: FormData) {
  await requireInviter();
  await mainRun("DELETE FROM invites WHERE code = ? AND used_by IS NULL", str(fd, "code"));
  revalidatePath("/invites");
}

// ---- 場所（ワークスペース）の名前の変更・削除（その場所のメンバーだけ） ----
export async function renameWorkspace(fd: FormData) {
  await requireOwner();
  const name = str(fd, "name").slice(0, 40);
  if (!name) return;
  const ws = await currentWorkspace();
  if (ws === MAIN) await setSetting("workspace.name", name);
  else await mainRun("UPDATE workspaces SET name = ? WHERE id = ?", name, ws);
  revalidatePath("/", "layout");
}

export async function deleteWorkspaceAction(fd: FormData) {
  await requireOwner();
  const ws = await currentWorkspace();
  if (ws === MAIN) redirect(`/settings?error=${enc("メインの場所は削除できません")}`);
  if (str(fd, "confirm") !== "削除") redirect(`/settings?error=${enc("確認のため「削除」と入力してください")}`);
  await deleteWorkspace(ws);
  const user = await sessionUser();
  const rest = user ? await workspacesOf(user) : [];
  if (rest[0]) await setWorkspaceCookie(rest[0].id);
  redirect(rest[0] ? "/dashboard" : "/login");
}

// ---- 友だち情報欄 ----
export async function createField(fd: FormData) {
  await requireOwner();
  const name = str(fd, "name").slice(0, 30);
  if (!name) return;
  await run("INSERT OR IGNORE INTO custom_fields (name, created_at) VALUES (?, ?)", name, Date.now());
  revalidatePath("/fields");
}

export async function deleteField(fd: FormData) {
  await requireOwner();
  const id = num(fd, "id");
  await run("DELETE FROM friend_fields WHERE field_id = ?", id);
  await run("DELETE FROM custom_fields WHERE id = ?", id);
  revalidatePath("/fields");
}

export async function saveFriendFields(fd: FormData) {
  await requireAuth();
  const friendId = num(fd, "friendId");
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^field_(\d+)$/);
    if (m) await setFieldValue(friendId, Number(m[1]), String(v).trim());
  }
  revalidatePath(`/friends/${friendId}`);
}

// ---- 導線テンプレート ----
export async function installTemplateAction(fd: FormData) {
  await requireOwner();
  const key = str(fd, "key");
  await installTemplate(key);
  revalidatePath("/templates");
  redirect(`/templates?done=${enc(key)}`);
}

// ---- 予約の受付 ----
export async function createSlotsAction(fd: FormData) {
  await requireAuth();
  const dates = str(fd, "dates").split(/[\s,、]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const times = str(fd, "times").split(/[\s,、]+/).map((t) => t.replace("：", ":")).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, "0"));
  const minutes = Math.min(Math.max(num(fd, "minutes") || 60, 5), 24 * 60);
  const capacity = Math.min(Math.max(num(fd, "capacity") || 1, 1), 1000);
  // 繰り返し：最初の日付から○週間分、同じ曜日にも作る
  const weeks = Math.min(Math.max(num(fd, "weeks") || 1, 1), 12);
  const all = dates.flatMap((d) =>
    Array.from({ length: weeks }, (_, i) => new Date(Date.parse(`${d}T00:00:00Z`) + i * 7 * 86400_000).toISOString().slice(0, 10)),
  );
  if (!all.length || !times.length) redirect(`/bookings?error=${enc("日付と時刻を入力してください")}`);
  const n = await createSlots(all, times, minutes, capacity);
  revalidatePath("/bookings");
  redirect(`/bookings?made=${n}`);
}

export async function deleteSlot(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await run("UPDATE bookings SET status = 'canceled' WHERE slot_id = ? AND status = 'booked'", id);
  await run("DELETE FROM booking_slots WHERE id = ?", id);
  revalidatePath("/bookings");
}

export async function adminCancelBooking(fd: FormData) {
  await requireAuth();
  await cancelBooking(num(fd, "id"));
  revalidatePath("/bookings");
}

export async function saveBookingSettings(fd: FormData) {
  await requireOwner();
  await setSetting(BOOKING_SETTINGS.title, str(fd, "title").slice(0, 40));
  await setSetting(BOOKING_SETTINGS.tagId, String(optId(fd, "tagId") ?? ""));
  await setSetting(BOOKING_SETTINGS.remindHours, String(Math.max(0, Math.min(num(fd, "remindHours"), 168))));
  await setSetting(BOOKING_SETTINGS.confirm, str(fd, "confirm").slice(0, 1000));
  revalidatePath("/bookings");
}

/** 友だちが予約ページから予約する（ログイン不要） */
export async function submitBooking(fd: FormData) {
  const token = str(fd, "f") || "open";
  const friend = token === "open" ? undefined : await getFriendByToken(token);
  const ws = await currentWorkspace();
  const name = str(fd, "name");
  if (!friend && !name) redirect(withWs(`/b/${token}?error=${enc("お名前を入力してください")}`, ws));
  try {
    await book(num(fd, "slotId"), friend, name, str(fd, "note"));
  } catch (e) {
    if (e instanceof BookingError) redirect(withWs(`/b/${token}?error=${enc(e.message)}`, ws));
    throw e;
  }
  redirect(withWs(`/b/${token}?done=1`, ws));
}

export async function cancelMyBooking(fd: FormData) {
  const token = str(fd, "f");
  const friend = token ? await getFriendByToken(token) : undefined;
  const ws = await currentWorkspace();
  if (!friend) redirect(withWs(`/b/open`, ws));
  await cancelBooking(num(fd, "id"), friend.id);
  redirect(withWs(`/b/${token}?canceled=1`, ws));
}

// ---- 行動スコア ----
export async function createScoreRule(fd: FormData) {
  await requireOwner();
  const kind = str(fd, "kind");
  const points = Math.trunc(num(fd, "points"));
  if (kind === "reach") {
    // ○点に達したらタグを付ける
    const tagId = optId(fd, "tagId");
    if (!tagId || points <= 0) redirect(`/scores?error=${enc("点数（1以上）とタグを選んでください")}`);
    await run("INSERT INTO score_rules (kind, ref_id, points, created_at) VALUES ('reach', ?, ?, ?)", tagId, points, Date.now());
  } else {
    if (!points) redirect(`/scores?error=${enc("点数を入力してください（マイナスも可）")}`);
    const refId = kind === "click" || kind === "form" || kind === "tag" ? optId(fd, `ref_${kind}`) : null;
    if (kind === "tag" && !refId) redirect(`/scores?error=${enc("タグを選んでください")}`);
    await run("INSERT INTO score_rules (kind, ref_id, points, created_at) VALUES (?, ?, ?, ?)", kind, refId, points, Date.now());
  }
  revalidatePath("/scores");
}

export async function deleteScoreRule(fd: FormData) {
  await requireOwner();
  await run("DELETE FROM score_rules WHERE id = ?", num(fd, "id"));
  revalidatePath("/scores");
}

export async function adjustScore(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  const delta = Math.trunc(num(fd, "delta"));
  if (delta) await changeScore(id, delta);
  revalidatePath(`/friends/${id}`);
}

// ---- メンバー（スタッフ）----
export async function createStaffInvite(fd: FormData) {
  await requireOwner();
  const user = (await sessionUser())!;
  // オーナー招待：自分の別の LINE アカウント（スマホ用など）や共同運営者を、すべて操作できる立場で入れる
  const role = str(fd, "role") === "owner" ? "owner" : "staff";
  await createInvite(user, str(fd, "note"), { ws: await currentWorkspace(), role });
  revalidatePath("/members");
}

export async function revokeStaffInvite(fd: FormData) {
  await requireOwner();
  await mainRun("DELETE FROM invites WHERE code = ? AND target_ws = ? AND used_by IS NULL", str(fd, "code"), await currentWorkspace());
  revalidatePath("/members");
}

export async function removeStaff(fd: FormData) {
  await requireOwner();
  // 自分自身と、この場所を作った人（最初のオーナー）は外せない
  const ws = await currentWorkspace();
  const target = str(fd, "user");
  const me = await sessionUser();
  const founder = await mainGet<{ owner_line_user_id: string }>("SELECT owner_line_user_id FROM workspaces WHERE id = ?", ws);
  if (target === me || target === founder?.owner_line_user_id) return;
  await mainRun("DELETE FROM workspace_members WHERE workspace_id = ? AND line_user_id = ?", ws, target);
  revalidatePath("/members");
}

// ---- 決済の自動判定（Stripe）----
export async function saveStripeSettings(fd: FormData) {
  await requireOwner();
  const secret = str(fd, "secret");
  if (secret) {
    if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) redirect(`/settings?error=${enc("署名シークレットは whsec_ で始まる文字です。Stripe の画面からそのままコピーしてください")}#stripe`);
    await setSetting(STRIPE_SECRET_KEY, secret);
  }
  if (fd.get("clearSecret")) await setSetting(STRIPE_SECRET_KEY, "");
  await setSetting(STRIPE_THANKS_KEY, str(fd, "thanks").slice(0, 1000));
  revalidatePath("/settings");
  redirect(`/settings?saved=${enc(formatJst(Date.now()))}#stripe`);
}

// ---- 返信の定型文（スタッフも使える） ----
export async function saveReplyTemplate(fd: FormData) {
  await requireAuth();
  const content = str(fd, "content").slice(0, 5000);
  const friendId = num(fd, "friendId");
  if (!content) redirect(`/friends/${friendId}?error=${enc("定型文にする文を入力してください")}`);
  const title = (str(fd, "templateTitle") || content.replace(/\s+/g, " ")).slice(0, 20);
  await run("INSERT INTO reply_templates (title, content, created_at) VALUES (?, ?, ?)", title, content, Date.now());
  revalidatePath(`/friends/${friendId}`);
}

export async function deleteReplyTemplate(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM reply_templates WHERE id = ?", num(fd, "id"));
  revalidatePath(`/friends/${num(fd, "friendId")}`);
}

// ---- 毎朝の数字レポート ----
export async function saveReportSettings(fd: FormData) {
  await requireOwner();
  await setSetting(REPORT_ENABLED, fd.get("enabled") ? "1" : "0");
  const time = str(fd, "time");
  if (/^\d{2}:\d{2}$/.test(time)) await setSetting(REPORT_TIME, time);
  revalidatePath("/settings");
  redirect(`/settings?saved=${enc(formatJst(Date.now()))}`);
}

// ---- 公式LINEの鍵で使い始める（招待なし）----
export async function claimWorkspaceAction(_: string | null, fd: FormData): Promise<string | null> {
  const user = await sessionUser();
  if (!user) redirect("/login");
  const channelId = str(fd, "channelId").replace(/\s/g, "");
  const channelSecret = str(fd, "channelSecret").replace(/\s/g, "");
  if (!/^\d{6,}$/.test(channelId) || !/^[0-9a-f]{32}$/i.test(channelSecret)) {
    return "Channel ID（数字）と Channel secret（32文字）を入れてください";
  }
  let result: Awaited<ReturnType<typeof claimByLineKeys>>;
  try {
    result = await claimByLineKeys(user, (await pendingName()) ?? "", channelId, channelSecret);
  } catch (e) {
    if (e instanceof ClaimError) return e.message;
    throw e;
  }
  await setWorkspaceCookie(result.ws);
  redirect(result.created ? "/line?welcome=1" : "/dashboard");
}
