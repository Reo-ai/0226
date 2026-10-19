import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE, dueJobs, jstParts } from "@/lib/scheduler";

// 2026-10-19 は月曜日。JST 07:30 = UTC 前日 22:30
const at = (iso: string) => new Date(iso);

describe("定期実行の判定", () => {
  it("JSTの日付・曜日・週を計算する", () => {
    expect(jstParts(at("2026-10-18T22:30:00Z"))).toMatchObject({ day: "2026-10-19", dow: 1, minutes: 450, week: "2026-10-19" });
    expect(jstParts(at("2026-10-25T05:00:00Z")).week).toBe("2026-10-19"); // 日曜は同じ週
  });
  it("時刻前は実行しない", () => {
    expect(dueJobs(DEFAULT_SCHEDULE, at("2026-10-18T21:59:00Z"), {})).toEqual([]); // JST 06:59
  });
  it("時刻を過ぎたら日次と週次を実行する", () => {
    const due = dueJobs(DEFAULT_SCHEDULE, at("2026-10-18T23:00:00Z"), {}); // 月曜 JST 08:00
    expect(due.map((d) => d.type)).toEqual(["daily_tasks", "weekly_report", "improvement"]);
  });
  it("同じ期間に二度実行しない", () => {
    const last = { daily_tasks: "2026-10-19", weekly_report: "2026-10-19", improvement: "2026-10-19" };
    expect(dueJobs(DEFAULT_SCHEDULE, at("2026-10-19T10:00:00Z"), last)).toEqual([]);
  });
  it("PCを閉じていた曜日のあとに起動しても、その週に1回実行する", () => {
    const due = dueJobs(DEFAULT_SCHEDULE, at("2026-10-22T01:00:00Z"), { daily_tasks: "2026-10-21" }); // 木曜
    expect(due.map((d) => d.type)).toEqual(["daily_tasks", "weekly_report", "improvement"]);
  });
  it("使い始めた週は週次ジョブを動かさない", () => {
    const due = dueJobs(DEFAULT_SCHEDULE, at("2026-10-19T10:00:00Z"), {}, "2026-10-19");
    expect(due.map((d) => d.type)).toEqual(["daily_tasks"]);
  });
  it("無効にすると何も実行しない", () => {
    expect(dueJobs({ ...DEFAULT_SCHEDULE, enabled: false }, at("2026-10-19T10:00:00Z"), {})).toEqual([]);
  });
});
