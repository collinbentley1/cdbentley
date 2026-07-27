/**
 * Renderer spike benchmark (WS-C Phase A).
 *
 * Method: serve the built spike pages in-process, drive them in Chrome
 * (playwright-core, channel "chrome", headless) with CDP
 * Emulation.setCPUThrottlingRate(4) as the throttled mobile profile,
 * deviceScaleFactor 2, and read window.__bench.run(600, 90) — per-frame CPU
 * ms (sim + render submission) and rAF frame deltas after 90 warmup frames.
 *
 * Run: bun run build && bun tools/bench-renderers.ts
 * Emits a markdown table on stdout; paste into reports/renderer-spike.md.
 */

import { chromium } from "playwright-core";

import { handleRequest } from "../src/server.ts";

interface Profile {
  name: string;
  cols: number;
  rows: number;
  cell: number;
  viewport: { width: number; height: number };
}

const PROFILES: Profile[] = [
  { cell: 8, cols: 200, name: "desktop 200x90 @8px", rows: 90, viewport: { height: 820, width: 1680 } },
  { cell: 6, cols: 110, name: "mobile 110x70 @6px", rows: 70, viewport: { height: 520, width: 720 } },
];

const PATHS = ["canvas2d", "webgl"] as const;
const MODES = ["drift", "churn", "full"] as const;
const THROTTLE = Number(Bun.env.BENCH_THROTTLE ?? 4);
const FRAMES = 600;
const WARMUP = 90;

const server = Bun.serve({ fetch: handleRequest, port: 0 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const version = browser.version();
const rows: string[] = [];
const infos: string[] = [];

try {
  for (const path of PATHS) {
    for (const profile of PROFILES) {
      for (const mode of MODES) {
        const context = await browser.newContext({ deviceScaleFactor: 2, viewport: profile.viewport });
        const page = await context.newPage();
        page.setDefaultTimeout(180000);
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

        // "full" only changes canvas2d (forced all-cells-dirty); it is run for
        // webgl too as a control (identical draw path either way).
        const modeQuery = mode === "churn" ? "&churn=1" : mode === "full" ? "&churn=1&full=1" : "";
        const query = `cols=${profile.cols}&rows=${profile.rows}&cell=${profile.cell}${modeQuery}`;
        const url = `http://localhost:${server.port}/ocean/spike/${path}.html?${query}`;
        await page.goto(url, { waitUntil: "load" });
        await page.waitForFunction(() => window.__bench?.ready === true);

        const stats = await page.evaluate(
          ({ frames, warmup }) => window.__bench.run(frames, warmup),
          { frames: FRAMES, warmup: WARMUP },
        );

        rows.push(
          `| ${path} | ${profile.name} | ${mode} | ${stats.avgFps.toFixed(1)} | ${stats.avgFrameMs.toFixed(2)} | ${stats.p95FrameMs.toFixed(2)} | ` +
            `${stats.avgCpuMs.toFixed(2)} | ${stats.p50CpuMs.toFixed(2)} | ${stats.p95CpuMs.toFixed(2)} | ${stats.maxCpuMs.toFixed(2)} | ` +
            `${stats.cpuOver8msPct.toFixed(1)}% | ${stats.frameOver17msPct.toFixed(1)}% |`,
        );
        infos.push(`- ${path} / ${profile.name} / ${mode}: ${stats.info} (${stats.frames} frames over ${stats.seconds.toFixed(1)}s)`);
        console.error(`done: ${path} ${profile.name} ${mode}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  server.stop(true);
}

console.log(`Chrome ${version}, headless, CDP cpuThrottlingRate=${THROTTLE}, deviceScaleFactor=2, ${FRAMES} frames after ${WARMUP} warmup.`);
console.log("");
console.log("| path | profile | mode | avg fps | avg frame ms | p95 frame ms | avg cpu ms | p50 cpu ms | p95 cpu ms | max cpu ms | cpu >8ms | frames >17ms |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");

for (const row of rows) {
  console.log(row);
}

console.log("");

for (const info of infos) {
  console.log(info);
}
