/** Re-capture the 1200x630 OG image from the trading-floor scene. */
import { chromium } from "playwright-core";

import { handleRequest } from "../src/server.ts";

const OUT = process.argv[2] ?? new URL("../public/assets/og/ocean-og.png", import.meta.url).pathname;

const server = Bun.serve({ fetch: handleRequest, port: 0 });
const base = `http://localhost:${server.port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  // OG spec: exactly 1200x630, no HiDPI scaling.
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1200, height: 630 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(700);

  // Pin the trading floor so its sticky stage fills the frame, and hide the
  // fixed chrome (shelf rail, social icons, any mid-flight dock traveler) so
  // the capture is the scene alone.
  await page.evaluate(() => {
    const sec = document.querySelector('section[data-scene="trading-floor"]') as HTMLElement | null;
    if (!sec) return;
    const top = window.scrollY + sec.getBoundingClientRect().top;
    window.scrollTo(0, top);
    document.querySelectorAll<HTMLElement>("#shelf, .social-links, .dock-traveler, .prose").forEach((el) => {
      el.style.display = "none";
    });
  });
  // Let the scene settle.
  await page.waitForTimeout(1500);

  await page.screenshot({ path: OUT, clip: { height: 630, width: 1200, x: 0, y: 0 } });
  await ctx.close();
} finally {
  await browser.close();
  server.stop(true);
}

console.log(`og -> ${OUT}`);
