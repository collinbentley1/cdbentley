import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, sep } from "node:path";

const PORT = Number(Bun.env.PORT ?? 3000);
const IS_BUILT_SERVER = import.meta.dir.endsWith("/dist");
const BUILT_PUBLIC_DIR = import.meta.dir.endsWith("/dist") ? join(import.meta.dir, "public") : join(import.meta.dir, "..", "dist", "public");
const SOURCE_PUBLIC_DIR = join(import.meta.dir, "..", "public");
const PUBLIC_DIR = Bun.env.PUBLIC_DIR ?? (IS_BUILT_SERVER ? BUILT_PUBLIC_DIR : SOURCE_PUBLIC_DIR);
const MAX_PATH_LENGTH = 2_048;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'none'; media-src 'none'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
};

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Documents that must revalidate on every request (route entry points). */
const NO_CACHE_PATHS: ReadonlySet<string> = new Set(["index.html", join("ocean", "index.html")]);

export async function handleRequest(request: Request): Promise<Response> {
  let omitBody = false;

  try {
    const method = request.method;
    omitBody = method === "HEAD";

    if (method !== "GET" && !omitBody) {
      return secureResponse(text("method not allowed", 405, { Allow: "GET, HEAD" }), false);
    }

    return secureResponse(await routeRequest(request), omitBody);
  } catch {
    console.error("request failed");
    return secureResponse(text("internal server error", 500), omitBody);
  }
}

if (import.meta.main) {
  const server = Bun.serve({
    development: false,
    error() {
      console.error("server request failed");
      return secureResponse(text("internal server error", 500), false);
    },
    fetch: handleRequest,
    hostname: "0.0.0.0",
    maxRequestBodySize: 1_024,
    port: PORT,
  });

  console.info(`listening on ${server.url}`);
}

async function routeRequest(request: Request): Promise<Response> {
  let url: URL;

  try {
    url = new URL(request.url);
  } catch {
    return text("bad request", 400);
  }

  if (url.pathname === "/livez") {
    return json(livenessPayload(Bun.env.PLATFORM_DEPLOY_NONCE));
  }

  return await serveStatic(url.pathname);
}

export function livenessPayload(deployment: string | undefined): {
  ok: true;
  deployment?: string;
} {
  return deployment ? { ok: true, deployment } : { ok: true };
}

async function serveStatic(pathname: string): Promise<Response> {
  if (pathname.length > MAX_PATH_LENGTH) {
    return text("uri too long", 414);
  }

  let pathnameWithoutSlash: string;
  try {
    const decoded = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));

    if (decoded.length > MAX_PATH_LENGTH) {
      return text("uri too long", 414);
    }

    if (CONTROL_CHARACTER_PATTERN.test(decoded) || decoded.includes("\\")) {
      return text("bad request", 400);
    }

    // Directory index (e.g. /ocean/ -> ocean/index.html).
    pathnameWithoutSlash = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
  } catch {
    return text("bad request", 400);
  }

  if (pathnameWithoutSlash.split("/").includes("..")) {
    return text("not found", 404);
  }

  const normalizedPath = normalize(pathnameWithoutSlash);

  if (isAbsolute(normalizedPath) || normalizedPath === ".." || normalizedPath.startsWith(`..${sep}`) || normalizedPath.includes(`${sep}..${sep}`)) {
    return text("not found", 404);
  }

  let filePath = await resolvePublicFile(PUBLIC_DIR, normalizedPath);

  if (filePath === null && !IS_BUILT_SERVER && PUBLIC_DIR === SOURCE_PUBLIC_DIR) {
    filePath = await resolvePublicFile(BUILT_PUBLIC_DIR, normalizedPath);
  }

  if (filePath === null) {
    return text("not found", 404);
  }

  const file = Bun.file(filePath);

  return new Response(file, {
    headers: {
      "Cache-Control": NO_CACHE_PATHS.has(normalizedPath) ? "no-cache" : "public, max-age=300",
      "Content-Length": String(file.size),
      "Content-Type": CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    },
  });
}

async function resolvePublicFile(rootDirectory: string, normalizedPath: string): Promise<string | null> {
  try {
    const resolvedRoot = await realpath(rootDirectory);
    const resolvedFile = await realpath(join(rootDirectory, normalizedPath));

    if (!resolvedFile.startsWith(`${resolvedRoot}${sep}`)) {
      return null;
    }

    const metadata = await stat(resolvedFile);
    return metadata.isFile() ? resolvedFile : null;
  } catch {
    return null;
  }
}

function secureResponse(response: Response, omitBody: boolean): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(omitBody ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function text(body: string, status: number, headers: HeadersInit = {}): Response {
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(new TextEncoder().encode(body).byteLength),
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
    },
    status,
  });
}

function json(body: unknown): Response {
  const payload = JSON.stringify(body);

  return new Response(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(new TextEncoder().encode(payload).byteLength),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
