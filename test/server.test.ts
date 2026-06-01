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

  test("serves the portfolio shell", async () => {
    const response = await handleRequest(new Request("http://localhost/"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(body).toContain("A WILD PORTFOLIO APPEARED");
    expect(body).toContain("/assets/client.js");
  });

  test("serves fixed static assets with revalidating cache headers", async () => {
    const response = await handleRequest(new Request("http://localhost/assets/styles.css"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  test("serves a crisp svg favicon", async () => {
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
