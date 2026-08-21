import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, spyOn, test } from "bun:test";
import { handleRequest, livenessPayload } from "../src/server.ts";

describe("server", () => {
  test("serves a health response", async () => {
    const response = await handleRequest(new Request("http://localhost/livez"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expectSecurityHeaders(response);
  });

  test("binds preview health to the platform deployment nonce", () => {
    const nonce = "a".repeat(64);

    expect(livenessPayload(nonce)).toEqual({ ok: true, deployment: nonce });
    expect(livenessPayload(undefined)).toEqual({ ok: true });
  });

  test("serves the ocean at the root", async () => {
    const response = await handleRequest(new Request("http://localhost/"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(body).toContain("<title>Collin Bentley</title>");
    expect(body).toContain('src="/assets/ocean/theme-init.js"');
    expect(body).toContain("/assets/ocean/descent.js");
    expectSecurityHeaders(response);
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

  test("allows only GET and HEAD", async () => {
    const response = await handleRequest(new Request("http://localhost/", { method: "POST" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(await response.text()).toBe("method not allowed");
    expectSecurityHeaders(response);
  });

  test("serves HEAD with GET metadata and no body", async () => {
    const getResponse = await handleRequest(new Request("http://localhost/"));
    const response = await handleRequest(new Request("http://localhost/", { method: "HEAD" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Content-Length")).toBe(getResponse.headers.get("Content-Length"));
    expect(await response.text()).toBe("");
    expectSecurityHeaders(response);
  });

  test("rejects malformed, control-character, and overlong paths", async () => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["/%E0%A4%A", 400],
      ["/%00", 400],
      ["/%0d", 400],
      ["/%7f", 400],
      [`/${"a".repeat(2_049)}`, 414],
    ];

    for (const [path, expectedStatus] of cases) {
      const response = await handleRequest(new Request(`http://localhost${path}`));
      expect(response.status).toBe(expectedStatus);
      expectSecurityHeaders(response);
    }
  });

  test("rejects encoded traversal rather than relying on URL dot-segment normalization", async () => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["/%2e%2e%2fpackage.json", 404],
      ["/..%2fpackage.json", 404],
      ["/%2e%2e%5cpackage.json", 400],
      ["/%2fetc%2fpasswd", 404],
    ];

    for (const [path, expectedStatus] of cases) {
      const response = await handleRequest(new Request(`http://localhost${path}`));
      expect(response.status).toBe(expectedStatus);
      expect(await response.text()).not.toContain('"name": "cdbentley"');
    }
  });

  test("does not follow a public-directory symlink outside the static root", async () => {
    const root = join(import.meta.dir, "..");
    const linkPath = join(root, "public", "assets", "outside-root-test.json");
    await rm(linkPath, { force: true });
    await symlink(join(root, "package.json"), linkPath);

    try {
      const response = await handleRequest(new Request("http://localhost/assets/outside-root-test.json"));
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("not found");
    } finally {
      await rm(linkPath, { force: true });
    }
  });

  test("converts unexpected request failures to a generic protected response", async () => {
    const errorLog = spyOn(console, "error").mockImplementation(() => {});
    const brokenRequest = {
      get method(): string {
        throw new Error("sensitive implementation detail");
      },
    } as Request;

    try {
      const response = await handleRequest(brokenRequest);
      const body = await response.text();

      expect(response.status).toBe(500);
      expect(body).toBe("internal server error");
      expect(body).not.toContain("sensitive implementation detail");
      expect(errorLog).toHaveBeenCalledWith("request failed");
      expectSecurityHeaders(response);
    } finally {
      errorLog.mockRestore();
    }
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

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("Content-Security-Policy")).toBe(
    "default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'none'; media-src 'none'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'none'",
  );
  expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  expect(response.headers.get("Origin-Agent-Cluster")).toBe("?1");
  expect(response.headers.get("Permissions-Policy")).toBe(
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
}
