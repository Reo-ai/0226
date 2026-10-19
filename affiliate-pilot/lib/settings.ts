import { z } from "zod";
import { prisma } from "./db";
import { parseJson } from "./schemas";

export async function getSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return parseJson(schema, row?.value, fallback);
}

export async function setSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}
