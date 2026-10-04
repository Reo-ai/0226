import JoinClient from "./JoinClient";

// サーバーを起こさずにすぐ返せるよう、データベースを使わない静的なページにする（経路の確認と記録は /api/join で行う）
export const dynamic = "force-static";

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const addUrl = process.env.LINE_ADD_FRIEND_URL;
  const liffId = process.env.LIFF_ID;
  if (!addUrl) return <p style={{ padding: 32 }}>LINE_ADD_FRIEND_URL が未設定です。</p>;
  return (
    <>
      <link rel="preconnect" href="https://static.line-scdn.net" />
      <link rel="preload" as="script" href="https://static.line-scdn.net/liff/edge/2/sdk.js" />
      <JoinClient liffId={liffId ?? ""} code={code} addUrl={addUrl} />
    </>
  );
}
