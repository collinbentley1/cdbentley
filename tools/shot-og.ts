/** Re-capture the 1200x630 OG image from the beach scene (legible name). */
import { chromium } from "playwright-core";

import { handleRequest } from "../src/server.ts";

const OUT = process.argv[2] ?? "/Users/collin/cdbentley-worktrees/ws-c-redesign/public/assets/og/ocean-og.png";

const server = Bun.serve({ fetch: handleRequest, port: 0 });
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  // OG spec: exactly 1200x630, no HiDPI scaling.
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1200, height: 630 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(700);

  // Pin the beach so its sticky stage fills the frame; the name in the sand
  // owns the composition (prose waits below the fold).
  await page.evaluate(() => {
    const sec = document.querySelector('section[data-scene="beach"]') as HTMLElement | null;
    if (!sec) return;
    const top = window.scrollY + sec.getBoundingClientRect().top;
    window.scrollTo(0, top);
  });
  // Let the name settle in the sand.
  await page.waitForTimeout(1500);

  await page.screenshot({ path: OUT, clip: { height: 630, width: 1200, x: 0, y: 0 } });
  await ctx.close();
} finally {
  await browser.close();
  server.stop(true);
}

console.log(`og -> ${OUT}`);
