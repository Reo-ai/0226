"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "../profile";
import { MANUAL_MILESTONES_KEY } from "../roadmap";
import { stringListSchema } from "../schemas";
import { getSetting, setSetting } from "../settings";

export async function toggleMilestone(fd: FormData) {
  await requireProfile();
  const key = String(fd.get("key") ?? "").slice(0, 120);
  if (!key) return;
  const list = await getSetting(MANUAL_MILESTONES_KEY, stringListSchema, []);
  await setSetting(MANUAL_MILESTONES_KEY, list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  revalidatePath("/roadmap");
  revalidatePath("/challenge");
  revalidatePath("/");
}
