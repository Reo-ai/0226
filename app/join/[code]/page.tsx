import { notFound, redirect } from "next/navigation";
import { get } from "@/lib/db";
import { recordVisit } from "@/lib/sources";
import type { Source } from "@/lib/types";
import JoinClient from "./JoinClient";

export const dynamic = "force-dynamic";

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const source = await get<Source>("SELECT * FROM sources WHERE code = ?", code);
  if (!source) notFound();
  const addUrl = process.env.LINE_ADD_FRIEND_URL;
  const liffId = process.env.LIFF_ID;
  if (!addUrl) return <p style={{ padding: 32 }}>LINE_ADD_FRIEND_URL が未設定です。</p>;
  if (!liffId || !process.env.LINE_LOGIN_CHANNEL_ID) {
    // LIFFなし: 訪問数だけ記録して友だち追加画面へ
    await recordVisit(source, null);
    redirect(addUrl);
  }
  return <JoinClient liffId={liffId} code={code} addUrl={addUrl} />;
}
