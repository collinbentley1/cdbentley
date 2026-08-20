import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { handleRequest } from "../src/server.ts";

describe("server", () => {
  test("serves a health response", async () => {
    const response = await handleRequest(new Request("http://localhost/livez"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test("serves the ocean at the root", async () => {
    const response = await handleRequest(new Request("http://localhost/"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(body).toContain("<title>Collin Bentley</title>");
    expect(body).toContain("/assets/ocean/descent.js");
  });

  test("redirect stub keeps /ocean/ links alive", async () => {
    const response = await handleRequest(new Request("http://localhost/ocean/"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(body).toContain('http-equiv="refresh"');
    expect(body).toContain("url=/");
  });

  test("serves fixed static assets with revalidating cache headers", async () => {
    const response = await handleRequest(new Request("http://localhost/assets/og/ocean-og.png"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  test("serves the ico favicon", async () => {
    const response = await handleRequest(new Request("http://localhost/favicon.ico"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/x-icon");
  });

  test("serves a crisp svg favicon", async () => {
    const response = await handleRequest(new Request("http://localhost/favicon.svg"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(body).toContain("crispEdges");
  });

  test("rejects unsafe static paths", async () => {
    const response = await handleRequest(new Request("http://localhost/%2e%2e/package.json"));

    expect(response.status).toBe(404);
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
