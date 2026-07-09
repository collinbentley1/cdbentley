import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(import.meta.dir, "..", "dist");
const publicDir = join(import.meta.dir, "..", "public");
const srcDir = join(import.meta.dir, "..", "src");
const distPublicDir = join(distDir, "public");

await rm(distDir, { force: true, recursive: true });
await mkdir(distPublicDir, { recursive: true });

const clientBuild = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "client.ts")],
  minify: true,
  naming: "assets/client.js",
  outdir: distPublicDir,
  sourcemap: "external",
  target: "browser",
});

assertBuild(clientBuild, "client");

// Ocean (WS-C): spike pages, the SDK demo harness, and any scene harness
// found at src/ocean/scenes/<sceneId>/harness.ts. Scene agents add their
// scene directory + a public/ocean/harness/<sceneId>.html page and this
// build picks them up — tools/build.ts itself stays frozen.
const spikeBuild = await Bun.build({
  entrypoints: [join(srcDir, "ocean", "spike", "pages", "canvas2d.ts"), join(srcDir, "ocean", "spike", "pages", "webgl.ts")],
  minify: true,
  naming: "assets/ocean/spike/[name].js",
  outdir: distPublicDir,
  sourcemap: "external",
  target: "browser",
});

assertBuild(spikeBuild, "ocean spike");

const harnessEntries: Array<{ id: string; path: string }> = [{ id: "demo", path: join(srcDir, "ocean", "sdk", "demo-harness.ts") }];

for (const entry of await readdir(join(srcDir, "ocean", "scenes"), { withFileTypes: true }).catch(() => [])) {
  if (entry.isDirectory()) {
    const harnessPath = join(srcDir, "ocean", "scenes", entry.name, "harness.ts");

    if (await Bun.file(harnessPath).exists()) {
      harnessEntries.push({ id: entry.name, path: harnessPath });
    }
  }
}

for (const { id, path } of harnessEntries) {
  const harnessBuild = await Bun.build({
    entrypoints: [path],
    minify: true,
    naming: `assets/ocean/harness/${id}.js`,
    outdir: distPublicDir,
    sourcemap: "external",
    target: "browser",
  });

  assertBuild(harnessBuild, `ocean harness ${id}`);
}

// Ocean (WS-C Phase C): the integrated descent page bundle.
const descentBuild = await Bun.build({
  entrypoints: [join(srcDir, "ocean", "descent", "descent.ts")],
  minify: true,
  naming: "assets/ocean/descent.js",
  outdir: distPublicDir,
  sourcemap: "external",
  target: "browser",
});

assertBuild(descentBuild, "ocean descent");

const serverBuild = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "server.ts")],
  external: ["*.html", "*.css"],
  minify: false,
  outdir: distDir,
  sourcemap: "external",
  target: "bun",
});

assertBuild(serverBuild, "server");

await Bun.write(join(distPublicDir, "index.html"), Bun.file(join(publicDir, "index.html")));
await Bun.write(join(distPublicDir, "favicon.svg"), Bun.file(join(publicDir, "favicon.svg")));
await cp(join(publicDir, "assets"), join(distPublicDir, "assets"), { recursive: true });
await cp(join(publicDir, "ocean"), join(distPublicDir, "ocean"), { recursive: true });

function assertBuild(result: Bun.BuildOutput, label: string): void {
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }

    throw new Error(`${label} build failed`);
  }
}
