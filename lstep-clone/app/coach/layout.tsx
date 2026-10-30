import Link from "next/link";
import { requireViewer, sessionUser, workspacesOf } from "@/lib/auth";
import { currentWorkspace } from "@/lib/workspace";
import "./coach.css";
import WsSwitch from "./WsSwitch";

export const dynamic = "force-dynamic";
export const metadata = { title: "生徒管理" };

// 生徒管理ツール：スキルステップのデータを共用した、独立した見た目の管理画面
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  const user = await sessionUser();
  const mine = user ? await workspacesOf(user) : [];
  const ws = await currentWorkspace();
  return (
    <div className="coach">
      <header className="coach-top">
        <Link href="/coach" className="coach-brand">
          ⚔ 生徒管理
        </Link>
        <nav>
          <Link href="/coach">質問</Link>
          <Link href="/coach/students">生徒</Link>
        </nav>
        <span className="coach-space" />
        {mine.length > 1 && <WsSwitch current={ws} list={mine} />}
      </header>
      <main className="coach-main">{children}</main>
    </div>
  );
}
