/**
 * Full-run descent benchmark (WS-C Phase C) — the Phase A method applied to
 * the integrated page: headless Chrome (playwright-core, channel "chrome"),
 * CDP Emulation.setCPUThrottlingRate(4) as the throttled mobile profile,
 * deviceScaleFactor 2 (the dpr cap). The page's ?bench=1 hook scripts a
 * constant-speed scroll top -> bottom -> top (compaction BOTH directions,
 * every scene crossing sleep/wake and dock/re-bloom) and records rAF frame
 * deltas plus the summed scene+field CPU per frame.
 *
 * Run: bun run build && bun tools/bench-descent.ts
 * Emits a markdown table; paste into reports/descent-benchmark.md.
 */

import { chromium } from "playwright-core";

import { handleRequest } from "../src/server.ts";

interface Profile {
  name: string;
  viewport: { width: number; height: number };
}

const PROFILES: Profile[] = [
  { name: "desktop 1680x820", viewport: { height: 820, width: 1680 } },
  { name: "mobile 390x844", viewport: { height: 844, width: 390 } },
];

const THROTTLE = Number(Bun.env.BENCH_THROTTLE ?? 4);
const SECONDS = Number(Bun.env.BENCH_SECONDS ?? 26);

const server = Bun.serve({ fetch: handleRequest, port: 0 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: string[] = [];

try {
  for (const profile of PROFILES) {
    const context = await browser.newContext({ deviceScaleFactor: 2, viewport: profile.viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(180000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

    await page.goto(`http://localhost:${server.port}/ocean/?bench=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__oceanBench?.ready === true);
    await page.waitForTimeout(1000);

    const stats = await page.evaluate((seconds) => window.__oceanBench?.run(seconds), SECONDS);

    if (!stats) {
      throw new Error("bench hook returned nothing");
    }

    rows.push(
      `| ${profile.name} | ${stats.avgFps.toFixed(1)} | ${stats.avgFrameMs.toFixed(2)} | ${stats.p95FrameMs.toFixed(2)} | ` +
        `${stats.avgCpuMs.toFixed(2)} | ${stats.p95CpuMs.toFixed(2)} | ${stats.frameOver17msPct.toFixed(1)}% | ${stats.frames} |`,
    );
    console.error(`done: ${profile.name}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop(true);
}

console.log(`Chrome headless, CDP cpuThrottlingRate=${THROTTLE}, deviceScaleFactor=2, full-run scroll top->bottom->top over ${SECONDS}s.`);
console.log("");
console.log("| profile | avg fps | avg frame ms | p95 frame ms | avg scene+field cpu ms | p95 cpu ms | frames >17ms | frames |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");

for (const row of rows) {
  console.log(row);
}
