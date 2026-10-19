import { all } from "./db";
import { blendedEpc, expectedEpc } from "./score";
import type { Program } from "./types";

export type ProgramStats = Program & {
  clicks: number;
  cv: number;
  earned: number; // 承認＋発生（否認を除く）
  approved: number;
  expEpc: number;
  epc: number;
};

/** 案件ごとの実績（since以降）と、想定・実績を混ぜたEPC */
export async function programStats(since = 0): Promise<ProgramStats[]> {
  const rows = await all<Program & { clicks: number; cv: number; earned: number; approved: number }>(
    `SELECT p.*,
       (SELECT COUNT(*) FROM clicks c JOIN links l ON l.id = c.link_id
          WHERE l.program_id = p.id AND c.created_at >= ?) clicks,
       (SELECT COUNT(*) FROM conversions v WHERE v.program_id = p.id AND v.status != 'rejected' AND v.occurred_at >= ?) cv,
       (SELECT COALESCE(SUM(amount), 0) FROM conversions v WHERE v.program_id = p.id AND v.status != 'rejected' AND v.occurred_at >= ?) earned,
       (SELECT COALESCE(SUM(amount), 0) FROM conversions v WHERE v.program_id = p.id AND v.status = 'approved' AND v.occurred_at >= ?) approved
     FROM programs p`,
    since,
    since,
    since,
    since,
  );
  return rows
    .map((p) => {
      // 発生分は承認率で割り引いて見込み額にする
      const expected = p.approved + (p.earned - p.approved) * (p.approval_rate / 100);
      return { ...p, expEpc: expectedEpc(p), epc: blendedEpc(p, p.clicks, expected) };
    })
    .sort((a, b) => b.epc - a.epc);
}

export type LinkStats = {
  id: number;
  code: string;
  name: string;
  channel: string;
  program_name: string | null;
  clicks: number;
  cv: number;
  earned: number;
};

export async function linkStats(since = 0): Promise<LinkStats[]> {
  return all<LinkStats>(
    `SELECT l.id, l.code, l.name, l.channel, p.name program_name,
       (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id AND c.created_at >= ?) clicks,
       (SELECT COUNT(*) FROM conversions v WHERE v.link_id = l.id AND v.status != 'rejected' AND v.occurred_at >= ?) cv,
       (SELECT COALESCE(SUM(amount), 0) FROM conversions v WHERE v.link_id = l.id AND v.status != 'rejected' AND v.occurred_at >= ?) earned
     FROM links l LEFT JOIN programs p ON p.id = l.program_id
     ORDER BY clicks DESC, l.id DESC`,
    since,
    since,
    since,
  );
}
