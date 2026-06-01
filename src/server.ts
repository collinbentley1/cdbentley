import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { buildLesson, parseBoard, scoreBoard } from "./lesson.ts";

const PORT = Number(Bun.env.PORT ?? 3000);
const BUILT_PUBLIC_DIR = import.meta.dir.endsWith("/dist") ? join(import.meta.dir, "public") : join(import.meta.dir, "..", "dist", "public");
const SOURCE_PUBLIC_DIR = join(import.meta.dir, "..", "public");
const PUBLIC_DIR = Bun.env.PUBLIC_DIR ?? (existsSync(BUILT_PUBLIC_DIR) ? BUILT_PUBLIC_DIR : SOURCE_PUBLIC_DIR);

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/healthz") {
    return json({ ok: true });
  }

  if (url.pathname === "/api/lesson") {
    return json(buildLesson(url.searchParams.get("seed") ?? undefined), {
      "Cache-Control": "no-store",
    });
  }

  if (url.pathname === "/api/score") {
    const lesson = buildLesson(url.searchParams.get("seed") ?? undefined);
    const board = parseBoard(url.searchParams.get("board"));

    if (!board) {
      return json({ error: "bad board" }, {}, 400);
    }

    return json(scoreBoard(board, lesson.glyph), {
      "Cache-Control": "no-store",
    });
  }

  return serveStatic(url.pathname);
}

if (import.meta.main) {
  const server = Bun.serve({
    fetch: handleRequest,
    hostname: "0.0.0.0",
    port: PORT,
  });

  console.info(`listening on ${server.url}`);
}

function json(body: unknown, headers: HeadersInit = {}, status = 200): Response {
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=60",
      ...headers,
    },
    status,
  });
}

async function serveStatic(pathname: string): Promise<Response> {
  const pathnameWithoutSlash = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const normalizedPath = normalize(pathnameWithoutSlash);

  if (normalizedPath.startsWith("..") || normalizedPath.includes("/../")) {
    return new Response("not found", { status: 404 });
  }

  const filePath = join(PUBLIC_DIR, normalizedPath);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return new Response("not found", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Cache-Control": normalizedPath === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    },
  });
}
