import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// LIFF のリンク（liff.line.me/<LIFF ID>/habit など）は、まず /join?liff.state=/habit に戻ってくる。
// その経路のページ（/join/habit）へ、ほかのパラメータ（?w= など）も付けたまま送る
export default async function JoinEntry({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const state = typeof sp["liff.state"] === "string" ? sp["liff.state"] : "";
  const [path, query = ""] = state.split("?");
  const code = path.replace(/^\/+/, "").split("/")[0];
  if (!/^[\w-]+$/.test(code)) notFound();
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(sp)) if (k !== "liff.state" && typeof v === "string") params.set(k, v);
  const q = params.toString();
  redirect(`/join/${code}${q ? `?${q}` : ""}`);
}
