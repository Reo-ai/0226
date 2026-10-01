import { get } from "@/lib/db";
import "../../../public.css";

export const dynamic = "force-dynamic";

export default async function Thanks({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await get<{ thanks_message: string }>("SELECT thanks_message FROM forms WHERE id = ?", Number(id));
  return (
    <div className="public">
      <div className="panel stack">
        <h1>送信しました</h1>
        <p className="pre">{form?.thanks_message || "ご回答ありがとうございました！"}</p>
        <p className="hint">この画面を閉じてLINEにお戻りください。</p>
      </div>
    </div>
  );
}
