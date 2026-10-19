import crypto from "node:crypto";
import { prisma } from "../db";
import { getSetting, setSetting } from "../settings";
import { z } from "zod";
import ai from "../../content/academy/ai";
import analytics from "../../content/academy/analytics";
import asp from "../../content/academy/asp";
import instagram from "../../content/academy/instagram";
import sales from "../../content/academy/sales";
import seo from "../../content/academy/seo";
import video from "../../content/academy/video";
import x from "../../content/academy/x";
import type { Course, Lesson } from "./schema";

export const COURSES: Course[] = [asp, seo, instagram, x, video, sales, ai, analytics].sort((a, b) => a.no - b.no);

export function findCourse(id: string) {
  return COURSES.find((c) => c.id === id);
}

export function findLesson(courseId: string, lessonId: string): { course: Course; lesson: Lesson; index: number } | null {
  const course = findCourse(courseId);
  const index = course?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
  return course && index >= 0 ? { course, lesson: course.lessons[index], index } : null;
}

/** 修了に必要なクイズの正答率 */
export const PASS_SCORE = 0.8;

const VERSION = crypto.createHash("sha1").update(JSON.stringify(COURSES)).digest("hex");

/**
 * 教材（コード内のデータ）を DB の Lesson / SourceReference に同期する。
 * 内容が変わったときだけ書き込む。進捗は Lesson の ID に紐づくので消えない。
 */
export async function syncLessons() {
  if ((await getSetting("academy_version", z.string(), "")) === VERSION && (await prisma.lesson.count()) > 0) return;
  for (const c of COURSES) {
    for (const [i, l] of c.lessons.entries()) {
      const { id, title, estimatedMinutes, sources, ...content } = l;
      const data = { courseId: c.id, title, content: JSON.stringify(content), lessonOrder: i + 1, estimatedMinutes, referenceUrls: JSON.stringify(sources) };
      await prisma.lesson.upsert({ where: { id }, create: { id, ...data }, update: data });
      for (const s of sources) {
        await prisma.sourceReference.upsert({
          where: { refKey_url: { refKey: `lesson:${id}`, url: s.url } },
          create: { refKey: `lesson:${id}`, title: s.title, url: s.url, sourceType: /caa\.go\.jp|mhlw\.go\.jp|nta\.go\.jp/.test(s.url) ? "law" : "official", verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : null, verificationStatus: s.status },
          update: { title: s.title },
        });
      }
    }
  }
  // コードから消えたレッスンは削除（進捗も一緒に消える）
  const ids = COURSES.flatMap((c) => c.lessons.map((l) => l.id));
  await prisma.lesson.deleteMany({ where: { id: { notIn: ids } } });
  await setSetting("academy_version", VERSION);
}

export const COURSE_TITLES: Record<string, string> = Object.fromEntries(COURSES.map((c) => [c.id, c.title]));
export const LESSON_TITLES: Record<string, string> = Object.fromEntries(COURSES.flatMap((c) => c.lessons.map((l) => [l.id, l.title])));
