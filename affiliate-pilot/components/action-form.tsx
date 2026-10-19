"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ErrorNote } from "@/components/ui/states";
import type { ActionState } from "@/lib/actions/form";
import { cn } from "@/lib/utils";

/** サーバーアクションのフォーム。エラーは欄内に、成功はトーストで表示する */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.ok);
      if (resetOnSuccess) ref.current?.reset();
    }
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={cn("flex flex-col gap-3", className)} aria-busy={pending}>
      {children}
      <ErrorNote message={state?.error} />
    </form>
  );
}
