import { CardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="読み込み中">
      <CardSkeleton lines={4} />
      <div className="grid gap-6 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
    </div>
  );
}
