import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { WORK_PAGES, type RunsettaDemo } from "../../content/work.ts";

/**
 * Pre-renders the 27 runsetta coach lines to audio files (§5.2: "pre-rendered
 * audio files, no live API"). Uses macOS `say` + `afconvert` — synthesized
 * stand-ins until Collin records the real set. Run: bun tools/audio/generate-coach.ts
 */

const OUT = join(import.meta.dir, "..", "..", "public", "assets", "audio", "coach");
const demo = WORK_PAGES.find((page) => page.slug === "runsetta")?.demo as RunsettaDemo | undefined;

if (!demo) {
  throw new Error("runsetta demo not found");
}

await rm(OUT, { force: true, recursive: true });
await mkdir(OUT, { recursive: true });

// Mood shapes delivery: zen slower, drill-sergeant brisk.
const RATES = [180, 150, 205];

let written = 0;
for (const [paceIndex, moods] of demo.lines.entries()) {
  for (const [moodIndex, weathers] of moods.entries()) {
    for (const [weatherIndex, line] of weathers.entries()) {
      const name = `coach-${paceIndex}-${moodIndex}-${weatherIndex}`;
      const aiff = `/tmp/${name}.aiff`;
      const target = join(OUT, `${name}.m4a`);
      const sayResult = Bun.spawnSync(["say", "-v", "Samantha", "-r", String(RATES[moodIndex] ?? 175), "-o", aiff, line]);
      if (sayResult.exitCode !== 0) {
        throw new Error(`say failed for ${name}: ${sayResult.stderr.toString()}`);
      }
      const convertResult = Bun.spawnSync(["afconvert", "-f", "mp4f", "-d", "aac", "-b", "49152", aiff, target]);
      if (convertResult.exitCode !== 0) {
        throw new Error(`afconvert failed for ${name}: ${convertResult.stderr.toString()}`);
      }
      await rm(aiff, { force: true });
      written += 1;
    }
  }
}

console.info(`${written} coach recordings written to ${OUT}`);
