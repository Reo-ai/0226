// 友だち情報欄（自由な項目）：誕生日・職業・申込日など、友だちごとに記録する
import { all, get, run } from "./db";

export interface Field {
  id: number;
  name: string;
}

export function listFields(): Promise<Field[]> {
  return all<Field>("SELECT id, name FROM custom_fields ORDER BY id");
}

/** 友だち1人の { 項目名: 値 } */
export async function fieldValuesOf(friendId: number): Promise<Record<string, string>> {
  const rows = await all<{ name: string; value: string }>(
    `SELECT c.name, v.value FROM friend_fields v JOIN custom_fields c ON c.id = v.field_id WHERE v.friend_id = ?`,
    friendId,
  );
  return Object.fromEntries(rows.map((r) => [r.name, r.value]));
}

export async function setFieldValue(friendId: number, fieldId: number, value: string) {
  if (value === "") {
    await run("DELETE FROM friend_fields WHERE friend_id = ? AND field_id = ?", friendId, fieldId);
    return;
  }
  await run(
    `INSERT INTO friend_fields (friend_id, field_id, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(friend_id, field_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    friendId,
    fieldId,
    value.slice(0, 500),
    Date.now(),
  );
}

/** フォームの回答のうち、質問名が友だち情報欄の項目名と同じものを保存する */
export async function saveAnswersToFields(friendId: number, answers: Record<string, string>) {
  for (const [label, value] of Object.entries(answers)) {
    const f = await get<{ id: number }>("SELECT id FROM custom_fields WHERE name = ?", label.trim());
    if (f && value) await setFieldValue(friendId, f.id, value);
  }
}
