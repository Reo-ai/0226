import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { isAuthed, sessionUser } from "@/lib/auth";
import { baseUrl } from "@/lib/env";
import { createHandoff } from "@/lib/handoff";
import { currentWorkspace } from "@/lib/workspace";
import Countdown from "./Countdown";

export const dynamic = "force-dynamic";

// スマホで開く：この画面のログインを、QRコードか6桁の番号でスマホに引き継ぐ
export default async function HandoffPage() {
  const user = await sessionUser();
  if (!user || !(await isAuthed())) redirect("/login");
  const { token, code, expiresAt } = await createHandoff(user, await currentWorkspace());
  const url = `${baseUrl()}/api/handoff/${token}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 280 });
  return (
    <>
      <h1>スマホで開く</h1>
      <div className="panel stack" style={{ alignItems: "center", textAlign: "center", gap: 16 }}>
        <p style={{ margin: 0 }}>スマホのカメラでQRコードを読むと、ログインした状態で開きます</p>
        <img src={qr} alt="スマホでログインするためのQRコード" width={240} height={240} />
        <div>
          <div className="hint">ホーム画面のアプリから開くときは、ログイン画面でこの番号を入れる</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: ".2em" }}>{code}</div>
        </div>
        <Countdown until={expiresAt} />
      </div>
    </>
  );
}
