import JoinClient from "./[code]/JoinClient";

// LIFF のリンク（liff.line.me/<LIFF ID>/habit）は /join?liff.state=/habit に戻ってくる。
// 以前はここで /join/habit へ転送していたが、1往復ぶん遅くなるので、このページで直接処理する（静的なページ）
export const dynamic = "force-static";

export default function JoinEntry() {
  const addUrl = process.env.LINE_ADD_FRIEND_URL;
  if (!addUrl) return <p style={{ padding: 32 }}>LINE_ADD_FRIEND_URL が未設定です。</p>;
  return (
    <>
      <link rel="preconnect" href="https://static.line-scdn.net" />
      <link rel="preload" as="script" href="https://static.line-scdn.net/liff/edge/2/sdk.js" />
      <JoinClient liffId={process.env.LIFF_ID ?? ""} code={null} addUrl={addUrl} />
    </>
  );
}
