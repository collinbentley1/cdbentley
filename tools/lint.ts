import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const failures: string[] = [];
// The root ocean document is self-hosted: its only external URLs are the
// social/profile links and the canonical OG url.
const allowedRootOrigins = new Set(["https://cdbentley.com", "https://github.com", "https://www.linkedin.com"]);

await requireContains("Dockerfile", "dhi.io/bun", "Dockerfile must use Docker Hardened Bun images.");
await requireContains("Dockerfile", "bun-v1.4.0", "Dockerfile must pin Bun 1.4.0.");
await requireContains("public/index.html", 'rel="icon"', "The document must link a favicon.");
await requireContains("public/index.html", 'src="/assets/ocean/theme-init.js"', "Inline scripts must stay external so the CSP can forbid them.");
await requireContains("public/index.html", 'href="/assets/ocean/site.css"', "Inline styles must stay external so the CSP can forbid them.");
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
