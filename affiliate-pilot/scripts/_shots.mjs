import { chromium, devices } from "@playwright/test";
const out = process.argv[2];
const b = await chromium.launch();
async function setup(ctx){ const p = await ctx.newPage(); await p.goto("http://localhost:3100/settings"); await p.getByRole("button", { name: /かんたん表示/ }).click(); return p; }
const pc = await b.newContext({ viewport: { width: 1360, height: 900 } });
let p = await setup(pc);
for (const [path, name] of [["/", "home"], ["/analytics", "analytics"], ["/offers", "offers"], ["/content", "content"]]) { await p.goto("http://localhost:3100"+path); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/pc-${name}.png` }); }
await p.emulateMedia({ colorScheme: "dark" }); await p.goto("http://localhost:3100/"); await p.evaluate(()=>document.documentElement.setAttribute("data-theme","dark")); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/pc-home-dark.png` });
const m = await b.newContext({ ...devices["Pixel 7"] });
p = await m.newPage(); await p.goto("http://localhost:3100/"); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/mobile-home.png`, fullPage: true });
await p.goto("http://localhost:3100/analytics"); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/mobile-analytics.png` });
await b.close();
