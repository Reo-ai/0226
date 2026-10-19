"use client";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** 送信中は押せなくし、文言を切り替えるボタン */
export function SubmitButton({ children, pendingLabel = "処理中…", ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
