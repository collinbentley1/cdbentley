import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const failures: string[] = [];
// The root ocean document is self-hosted: its only external URLs are the
// social/profile links and the canonical OG url.
const allowedRootOrigins = new Set(["https://cdbentley.com", "https://github.com", "https://www.linkedin.com"]);

await requireContains("Dockerfile", "dhi.io/bun", "Dockerfile must use Docker Hardened Bun images.");
await requireContains(
  "Dockerfile",
  "FROM oven/bun:1.4.0@sha256:",
  "Dockerfile must pin Bun 1.4.0 by digest.",
);
await requireContains("public/index.html", 'rel="icon"', "The document must link a favicon.");
await requireContentVersionedReference("public/index.html", "public/assets/ocean/theme-init.js", "src");
await requireContentVersionedReference("public/index.html", "public/assets/ocean/site.css", "href");
await rejectContains("public/index.html", "<script>", "Inline scripts are forbidden by the production CSP.");
await rejectContains("public/index.html", "<style", "Inline styles are forbidden by the production CSP.");
await rejectInlineDocumentContent(join(root, "public"));
await rejectContains("tools/build.ts", "sourcemap:", "Production builds must not publish source maps.");
await rejectUnapprovedHttpsUrls("public/index.html", allowedRootOrigins);
await import("./verify-socket-config.ts");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

async function requireContains(path: string, needle: string, message: string): Promise<void> {
  const text = await readFile(join(root, path), "utf8");
  if (!text.includes(needle)) {
    failures.push(`${path}: ${message}`);
  }
}

async function requireContentVersionedReference(documentPath: string, assetPath: string, attribute: "href" | "src"): Promise<void> {
  const asset = await readFile(join(root, assetPath));
  const digest = createHash("sha256").update(asset).digest("hex");
  const publicPath = `/${assetPath.slice("public/".length)}`;
  const expected = `${attribute}="${publicPath}?v=${digest}"`;
  const document = await readFile(join(root, documentPath), "utf8");

  if (!document.includes(expected)) {
    failures.push(`${documentPath}: ${assetPath} must use its full SHA-256 query version (${expected}).`);
  }
}

async function rejectContains(path: string, needle: string, message: string): Promise<void> {
  const text = await readFile(join(root, path), "utf8");
  if (text.includes(needle)) {
    failures.push(`${path}: ${message}`);
  }
}

async function rejectUnapprovedHttpsUrls(path: string, allowedOrigins: ReadonlySet<string>): Promise<void> {
  const text = await readFile(join(root, path), "utf8");
  const urls = text.match(/https:\/\/[^"'\s<>]+/g) ?? [];

  for (const value of urls) {
    const url = new URL(value);
    if (!allowedOrigins.has(url.origin)) {
      failures.push(`${path}: external URL is not approved: ${value}`);
    }
  }
}

async function rejectInlineDocumentContent(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await rejectInlineDocumentContent(entryPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".html")) {
      continue;
    }

    const document = await readFile(entryPath, "utf8");
    const relativePath = entryPath.slice(root.length + 1);
    if (/<style(?:\s|>)/i.test(document)) {
      failures.push(`${relativePath}: inline styles are forbidden by the production CSP.`);
    }
    if (/\sstyle\s*=/i.test(document)) {
      failures.push(`${relativePath}: inline style attributes are forbidden by the production CSP.`);
    }
    if (/\son[a-z]+\s*=/i.test(document)) {
      failures.push(`${relativePath}: inline event handlers are forbidden by the production CSP.`);
    }
    for (const match of document.matchAll(/<script\b([^>]*)>/gi)) {
      if (!/\bsrc\s*=/.test(match[1] ?? "")) {
        failures.push(`${relativePath}: inline scripts are forbidden by the production CSP.`);
      }
    }
  }
}
