import { extname, isAbsolute, join, normalize, sep } from "node:path";
import { ESSAYS } from "../content/notes.ts";
import { SITE } from "../content/site.ts";
import { WORK_PAGES } from "../content/work.ts";
import { dojoPage } from "./pages/dojo.ts";
import { journeyPage } from "./pages/journey.ts";
import { essayPage, notesIndexPage } from "./pages/notes.ts";
import { notFoundPage } from "./pages/notfound.ts";
import { workDetailPage, workIndexPage } from "./pages/work.ts";

const PORT = Number(Bun.env.PORT ?? 3000);
const IS_BUILT_SERVER = import.meta.dir.endsWith("/dist");
const BUILT_PUBLIC_DIR = IS_BUILT_SERVER ? join(import.meta.dir, "public") : join(import.meta.dir, "..", "dist", "public");
const SOURCE_PUBLIC_DIR = join(import.meta.dir, "..", "public");
const PUBLIC_DIR = Bun.env.PUBLIC_DIR ?? (IS_BUILT_SERVER ? BUILT_PUBLIC_DIR : SOURCE_PUBLIC_DIR);

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

/** Routes render once at startup; every page is a pure function of the typed content files. */
const PAGES = new Map<string, string>([
  ["/", journeyPage()],
  ["/dojo", dojoPage()],
  ["/notes", notesIndexPage()],
  ["/work", workIndexPage()],
]);

for (const page of WORK_PAGES) {
  const html = workDetailPage(page.slug);
  if (html) {
    PAGES.set(`/work/${page.slug}`, html);
  }
}

for (const essay of ESSAYS) {
  if (essay.published) {
    const html = essayPage(essay.slug);
    if (html) {
      PAGES.set(`/notes/${essay.slug}`, html);
    }
  }
}

const NOT_FOUND_HTML = notFoundPage();
const SITEMAP = buildSitemap();
const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;

  if (pathname === "/healthz") {
    return json({ ok: true });
  }

  if (pathname === "/sitemap.xml") {
    return new Response(SITEMAP, { headers: { "Cache-Control": "public, max-age=3600", "Content-Type": CONTENT_TYPES[".xml"] ?? "" } });
  }

  if (pathname === "/robots.txt") {
    return new Response(ROBOTS, { headers: { "Cache-Control": "public, max-age=3600", "Content-Type": CONTENT_TYPES[".txt"] ?? "" } });
  }

  const page = PAGES.get(pathname);
  if (page) {
    return htmlResponse(page);
  }

  if (extname(pathname) !== "") {
    return serveStatic(pathname);
  }

  return htmlResponse(NOT_FOUND_HTML, 404);
}

if (import.meta.main) {
  const server = Bun.serve({
    fetch: handleRequest,
    hostname: "0.0.0.0",
    port: PORT,
  });

  console.info(`listening on ${server.url}`);
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": CONTENT_TYPES[".html"] ?? "",
    },
    status,
  });
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

function buildSitemap(): string {
  const urls = [...PAGES.keys()]
    .sort()
    .map((path) => `  <url><loc>${SITE.origin}${path === "/" ? "" : path}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function serveStatic(pathname: string): Promise<Response> {
  let pathnameWithoutSlash: string;
  try {
    pathnameWithoutSlash = decodeURIComponent(pathname.slice(1));
  } catch {
    return new Response("not found", { status: 404 });
  }

  const requestedPath = pathnameWithoutSlash === "favicon.ico" ? "favicon.svg" : pathnameWithoutSlash;
  const normalizedPath = normalize(requestedPath);

  if (isAbsolute(normalizedPath) || normalizedPath === ".." || normalizedPath.startsWith(`..${sep}`) || normalizedPath.includes(`${sep}..${sep}`)) {
    return new Response("not found", { status: 404 });
  }

  let filePath = join(PUBLIC_DIR, normalizedPath);
  let file = Bun.file(filePath);

  if (!(await file.exists()) && !IS_BUILT_SERVER && PUBLIC_DIR === SOURCE_PUBLIC_DIR) {
    filePath = join(BUILT_PUBLIC_DIR, normalizedPath);
    file = Bun.file(filePath);
  }

  if (!(await file.exists())) {
    return new Response("not found", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    },
  });
}
