import { platformLabel } from "@/lib/constants";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { dateKey } from "@/lib/format";
import { getProfile } from "@/lib/profile";
import { RECORD_CSV_HEADER, RECORD_FIELDS } from "@/lib/records";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });
  const rows = await prisma.performanceRecord.findMany({ orderBy: { recordDate: "asc" }, include: { channel: true, offer: true, publication: true } });
  const body = toCsv(
    RECORD_CSV_HEADER,
    rows.map((r) => [dateKey(r.recordDate), platformLabel(r.platform), r.channel?.accountName ?? "", r.offer?.name ?? "", r.publication?.publishedUrl ?? "", ...RECORD_FIELDS.map(([k]) => r[k]), r.note]),
  );
  return csvResponse(`affiliate-pilot-records-${dateKey(new Date())}.csv`, body);
}
