"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
const LABEL = { light: "ライト", dark: "ダーク", system: "端末に合わせる" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" aria-label={`表示: ${LABEL[current] ?? "端末"}（押すと${LABEL[next]}）`} onClick={() => setTheme(next)}>
      <Icon />
    </Button>
  );
}
