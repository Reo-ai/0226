import { Header } from "@/components/shell/header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { requireProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 pb-28 pt-6 lg:pb-12"
          style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
