import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/actions/login";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <main className="mx-auto mt-[15vh] max-w-sm px-4">
      <h1 className="text-xl font-bold">Affiliate Pilot AI</h1>
      <p className="mt-1 text-sm text-muted-foreground">パスワードを入力してください。</p>
      <ActionForm action={login} className="mt-6">
        <input type="hidden" name="next" value={next} />
        <Input type="password" name="password" aria-label="パスワード" required autoFocus autoComplete="current-password" />
        <SubmitButton>ログイン</SubmitButton>
      </ActionForm>
    </main>
  );
}
