"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "コピー", size = "sm" }: { text: string; label?: string; size?: "sm" | "default" }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success("コピーしました");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("コピーできませんでした。テキストを選択してコピーしてください");
    }
  }
  return (
    <Button type="button" variant="outline" size={size} onClick={copy} aria-label={label}>
      {done ? <Check /> : <Copy />}{size === "default" && label}
    </Button>
  );
}
