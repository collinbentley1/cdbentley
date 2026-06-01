import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const failures: string[] = [];
const allowedIndexOrigins = new Set(["https://fonts.googleapis.com", "https://fonts.gstatic.com"]);

await requireContains("Dockerfile", "dhi.io/bun", "Dockerfile must use Docker Hardened Bun images.");
await requireContains("Dockerfile", "bun upgrade --canary", "Dockerfile must upgrade Bun to the latest canary.");
await requireContains("public/index.html", 'rel="icon"', "The document must link a favicon.");
await requireContains("public/index.html", "family=Press+Start+2P&family=Caveat", "The document must load the portfolio display fonts.");
await rejectUnapprovedHttpsUrls("public/index.html", allowedIndexOrigins);
await rejectContains("public/assets/styles.css", "@import", "Styles should not import third-party design libraries.");
await rejectContains("src/client.ts", "react", "The frontend should stay framework-free.");

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
