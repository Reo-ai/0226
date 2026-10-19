"use client";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as React from "react";
import { buttonVariants } from "./button";

/** 破壊的操作の確認ダイアログ。trigger を押すと確認してから onConfirm（または form 送信）を実行 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "実行する",
  formAction,
  hidden,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  formAction: (fd: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
}) {
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-lg">
          <AlertDialogPrimitive.Title className="text-lg font-bold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">{description}</AlertDialogPrimitive.Description>
          <form action={formAction} className="mt-6 flex justify-end gap-2">
            {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: "outline" })}>キャンセル</AlertDialogPrimitive.Cancel>
            <button type="submit" className={buttonVariants({ variant: "destructive" })}>{confirmLabel}</button>
          </form>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
