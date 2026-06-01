import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { handleRequest } from "../src/server.ts";
import { buildLesson, serializeBoard } from "../src/lesson.ts";

describe("server", () => {
  test("serves a lesson api response", async () => {
    const response = await handleRequest(new Request("http://localhost/api/lesson?seed=yale"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Collin Bentley");
    expect(body.seed).toBe("yale");
  });

  test("scores solved boards through the api", async () => {
    const lesson = buildLesson("api");
    const board = serializeBoard(lesson.glyph);
    const response = await handleRequest(new Request(`http://localhost/api/score?seed=api&board=${board}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.solved).toBe(true);
  });

  test("rejects malformed score boards", async () => {
    const response = await handleRequest(new Request("http://localhost/api/score?seed=api&board=bad"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("bad board");
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
