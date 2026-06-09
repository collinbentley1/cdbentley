import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(import.meta.dir, "..", "dist");
const publicDir = join(import.meta.dir, "..", "public");
const distPublicDir = join(distDir, "public");

await rm(distDir, { force: true, recursive: true });
await mkdir(distPublicDir, { recursive: true });

const clientBuild = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "client", "journey.ts"), join(import.meta.dir, "..", "src", "client", "dojo.ts"), join(import.meta.dir, "..", "src", "client", "work.ts"), join(import.meta.dir, "..", "src", "client", "shared.ts")],
  minify: true,
  naming: "assets/[name].js",
  outdir: distPublicDir,
  sourcemap: "external",
  target: "browser",
});

assertBuild(clientBuild, "client");

const serverBuild = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "server.ts")],
  minify: false,
  outdir: distDir,
  sourcemap: "external",
  target: "bun",
});

assertBuild(serverBuild, "server");

await Bun.write(join(distPublicDir, "favicon.svg"), Bun.file(join(publicDir, "favicon.svg")));
await Bun.write(join(distPublicDir, "favicon-32.png"), Bun.file(join(publicDir, "favicon-32.png")));
await Bun.write(join(distPublicDir, "favicon-16.png"), Bun.file(join(publicDir, "favicon-16.png")));
await cp(join(publicDir, "assets"), join(distPublicDir, "assets"), { recursive: true });

function assertBuild(result: Bun.BuildOutput, label: string): void {
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }

    throw new Error(`${label} build failed`);
  }
}
