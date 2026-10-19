import { exportAll } from "@/lib/backup";
import { dateKey } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body = JSON.stringify(await exportAll(), null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="affiliate-pilot-backup-${dateKey(new Date())}.json"`,
      "cache-control": "no-store",
    },
  });
}
