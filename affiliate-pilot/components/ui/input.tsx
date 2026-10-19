import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-24 resize-y", className)} {...props} />;
}
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(field, "h-10 pr-8", className)} {...props} />;
}
