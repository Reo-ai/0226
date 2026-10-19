// ダブルクリック起動用: 必要な準備をすべて行ってからアプリを起動し、ブラウザを開く
//   npm run app   または  起動.command（Mac）／起動.bat（Windows）
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const PORT = process.env.PORT || "3000";
const url = `http://localhost:${PORT}`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const log = (m) => console.log(`\n▶ ${m}`);
const run = (cmd) => execSync(cmd, { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });

try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 12)) {
    console.error(`Node.js 20.12 以上が必要です（今は ${process.versions.node}）。https://nodejs.org/ja から LTS 版を入れてください。`);
    process.exit(1);
  }
  if (!fs.existsSync(".env")) {
    fs.copyFileSync(".env.example", ".env");
    log(".env を作成しました（必要なら後で編集できます）");
  }
  if (!fs.existsSync("node_modules")) {
    log("初回のみ: 必要なパッケージを入れています（数分かかります）");
    run(`${npm} install --no-audit --no-fund`);
  }
  log("データベースを準備しています");
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");

  // ソースが更新されていればビルドし直す（.next より新しいファイルがあるか）
  const buildStamp = path.join(".next", "BUILD_ID");
  const builtAt = fs.existsSync(buildStamp) ? fs.statSync(buildStamp).mtimeMs : 0;
  const newest = (dir) => {
    let t = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!["node_modules", ".next", "prisma", "tests"].includes(e.name)) t = Math.max(t, newest(p)); }
      else t = Math.max(t, fs.statSync(p).mtimeMs);
    }
    return t;
  };
  if (!builtAt || newest(".") > builtAt) {
    log("アプリを組み立てています（初回や更新後は1〜2分かかります）");
    run(`${npm} run build`);
  }

  log(`起動します: ${url}（終了するにはこのウィンドウを閉じるか Ctrl+C）`);
  const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: "inherit", shell: process.platform === "win32" });
  setTimeout(() => {
    const opener = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
    try { execSync(opener, { stdio: "ignore" }); } catch { console.log(`ブラウザで ${url} を開いてください`); }
  }, 2500);
  server.on("exit", (code) => process.exit(code ?? 0));
} catch (e) {
  console.error("\n起動に失敗しました。上のメッセージを確認してください。");
  console.error(e instanceof Error ? e.message : e);
  if (process.platform === "win32") { console.log("\nEnter を押すと閉じます"); fs.readFileSync(0); }
  process.exit(1);
}
