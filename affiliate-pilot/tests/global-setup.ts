import { execSync } from "node:child_process";
import fs from "node:fs";

export default function setup() {
  for (const f of ["prisma/test.db", "prisma/test.db-journal"]) fs.rmSync(f, { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./test.db" }, stdio: "pipe" });
}
