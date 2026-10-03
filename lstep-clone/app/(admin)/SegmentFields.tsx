import type { Field } from "@/lib/fields";
import type { Segment } from "@/lib/segment";
import type { Tag } from "@/lib/types";

/** 友だちの絞り込み条件の入力欄（友だち一覧・一斉配信で共通） */
export default function SegmentFields({
  tags,
  sources,
  fields,
  value,
}: {
  tags: (Tag & { n?: number })[];
  sources: { id: number; name: string }[];
  fields: Field[];
  value: Segment;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <fieldset className="row">
        <legend>
          タグ（
          <select name="tagMode" defaultValue={value.tagMode} style={{ padding: "2px 4px" }}>
            <option value="any">いずれかを持つ人</option>
            <option value="all">すべてを持つ人</option>
          </select>
          ）
        </legend>
        {tags.map((t) => (
          <label key={t.id} className="row">
            <input type="checkbox" name="tagIds" value={t.id} defaultChecked={value.tagIds.includes(t.id)} /> {t.name}
            {t.n != null ? `（${t.n}）` : ""}
          </label>
        ))}
        {tags.length === 0 && <span className="muted">タグがありません</span>}
      </fieldset>
      <details open={value.excludeTagIds.length > 0 || Boolean(value.sourceId || value.habitMin || value.addedWithinDays || value.scoreMin || value.fieldId)}>
        <summary className="hint" style={{ cursor: "pointer" }}>くわしい条件（除外・流入元・習慣・追加日・友だち情報）</summary>
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <fieldset className="row">
            <legend>このタグを持つ人は除く</legend>
            {tags.map((t) => (
              <label key={t.id} className="row">
                <input type="checkbox" name="excludeTagIds" value={t.id} defaultChecked={value.excludeTagIds.includes(t.id)} /> {t.name}
              </label>
            ))}
          </fieldset>
          <div className="row">
            <label className="row">
              流入元
              <select name="sourceId" defaultValue={value.sourceId ?? ""}>
                <option value="">指定なし</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="row">
              習慣の連続
              <input type="number" name="habitMin" min={1} defaultValue={value.habitMin ?? ""} style={{ width: 70 }} /> 日以上
            </label>
            <label className="row">
              友だち追加が
              <input type="number" name="addedWithinDays" min={1} defaultValue={value.addedWithinDays ?? ""} style={{ width: 70 }} /> 日以内
            </label>
            <label className="row">
              行動スコア
              <input type="number" name="scoreMin" min={1} defaultValue={value.scoreMin ?? ""} style={{ width: 70 }} /> 点以上
            </label>
          </div>
          {fields.length > 0 && (
            <div className="row">
              <label className="row">
                友だち情報
                <select name="fieldId" defaultValue={value.fieldId ?? ""}>
                  <option value="">指定なし</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="row">
                に
                <input name="fieldValue" defaultValue={value.fieldValue} placeholder="含む文字" style={{ width: 140 }} />
                を含む
              </label>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
