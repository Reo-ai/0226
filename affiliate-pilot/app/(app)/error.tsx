"use client";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/states";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-bold">画面を表示できませんでした</h1>
      <ErrorNote message="一時的なエラーの可能性があります。再読み込みしても直らない場合は、設定画面からデータのバックアップを取ってください。" />
      <Button onClick={reset}>もう一度読み込む</Button>
    </div>
  );
}
