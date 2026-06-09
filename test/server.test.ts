import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { handleRequest } from "../src/server.ts";

describe("server", () => {
  test("serves a health response", async () => {
    const response = await handleRequest(new Request("http://localhost/healthz"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("serves the journey with origin-first scenes and no Nintendo trade dress", async () => {
    const response = await handleRequest(new Request("http://localhost/"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(body).toContain("The journey of a teacher who builds");
    expect(body).toContain("THE STABLES");
    expect(body).toContain("LV. 29");
    expect(body).toContain("to be continued…");
    expect(body).toContain("/assets/journey.js");
    expect(body.indexOf("THE STABLES")).toBeLessThan(body.indexOf("OTSEEK"));
    expect(body).not.toContain("WILD PORTFOLIO");
    expect(body).not.toContain("pokeball");
    expect(body).not.toContain("LV.∞");
  });

  test("every page carries footer links and per-route meta", async () => {
    for (const path of ["/", "/work", "/work/medlock", "/notes", "/dojo"]) {
      const response = await handleRequest(new Request(`http://localhost${path}`));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain("github.com/collinbentley1");
      expect(body).toContain("linkedin.com/in/collinbentley");
      expect(body).toContain("mailto:collin.bentley@me.com");
      expect(body).toContain("colophon");
      expect(body).toContain('property="og:image"');
      expect(body).toContain('name="description"');
    }
  });

  test("work pages render the uniform evidence template", async () => {
    for (const slug of ["medlock", "ava", "otseek", "runsetta", "critical-history"]) {
      const response = await handleRequest(new Request(`http://localhost/work/${slug}`));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain("THE PROBLEM");
      expect(body).toContain("WHAT I BUILT");
      expect(body).toContain("BUILD NOTES");
      expect(body).toContain("WHAT IT TAUGHT ME");
    }
  });

  test("ava page keeps the operator anonymized until CONFIRM-2", async () => {
    const response = await handleRequest(new Request("http://localhost/work/ava"));
    const body = await response.text();

    expect(body).not.toContain("coloradorafting.net");
    expect(body).not.toContain("AVA Rafting");
  });

  test("notes ships essay one and two stubs", async () => {
    const index = await (await handleRequest(new Request("http://localhost/notes"))).text();
    expect(index).toContain("What riding instructors know that growth teams don");
    expect(index).toContain("trail not yet walked — soon");

    const essay = await handleRequest(new Request("http://localhost/notes/riding-instructors"));
    const body = await essay.text();
    expect(essay.status).toBe(200);
    expect(body).toContain("Ask whether the human grew");
  });

  test("dojo renders the scripted screens with no API calls", async () => {
    const response = await handleRequest(new Request("http://localhost/dojo"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("THE DOJO");
    expect(body).toContain("GIVE IT A ROLE");
    expect(body).toContain("plan me a trip");
    expect(body).toContain("/assets/dojo.js");
  });

  test("serves sitemap and robots", async () => {
    const sitemap = await (await handleRequest(new Request("http://localhost/sitemap.xml"))).text();
    expect(sitemap).toContain("<loc>https://cdbentley.com/work/medlock</loc>");
    expect(sitemap).toContain("<loc>https://cdbentley.com/dojo</loc>");

    const robots = await (await handleRequest(new Request("http://localhost/robots.txt"))).text();
    expect(robots).toContain("Sitemap: https://cdbentley.com/sitemap.xml");
  });

  test("serves fixed static assets with revalidating cache headers", async () => {
    const response = await handleRequest(new Request("http://localhost/assets/styles.css"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  test("serves sprite assets as png images", async () => {
    const response = await handleRequest(new Request("http://localhost/assets/sprites/trainer-sheet.png"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  test("serves a crisp cairn favicon", async () => {
    const response = await handleRequest(new Request("http://localhost/favicon.ico"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(body).toContain("<svg");
    expect(body).toContain("shape-rendering=\"crispEdges\"");
  });

  test("rejects unsafe static paths", async () => {
    const response = await handleRequest(new Request("http://localhost/%2e%2e/package.json"));

    expect(response.status).toBe(404);
  });

  test("unknown trails get the pixel 404", async () => {
    const response = await handleRequest(new Request("http://localhost/this-trail-does-not-exist"));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).toContain("No cairn marks this trail");
  });

  test("serves built-only assets during source dev", async () => {
    const builtAssetPath = join(import.meta.dir, "..", "dist", "public", "assets", "dev-only.js");
    await mkdir(dirname(builtAssetPath), { recursive: true });
    await writeFile(builtAssetPath, "console.log('dev asset');");

    try {
      const response = await handleRequest(new Request("http://localhost/assets/dev-only.js"));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
      expect(body).toContain("dev asset");
    } finally {
      await rm(builtAssetPath, { force: true });
    }
  });
});
