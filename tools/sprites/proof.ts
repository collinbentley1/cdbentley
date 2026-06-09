import { join } from "node:path";
import { type CompanionArt, COMPANIONS, type Part } from "./companions.ts";
import { blit, fromGrid, scale } from "./pixel.ts";
import { createImage, encodePng, type Image } from "./png.ts";

/** Render every companion frame at 4x onto one parchment proof sheet for visual review. */

export function buildFrame(art: CompanionArt, parts: Part[]): Image {
  const frame = createImage(art.width, art.height);
  for (const part of parts) {
    blit(frame, fromGrid(part.grid, art.palette), part.x, part.y);
  }
  return frame;
}

if (import.meta.main) {
  const ZOOM = 4;
  const CELL = 30 * ZOOM;
  const columns = 6;
  const rows = COMPANIONS.length;
  const sheetImage = createImage(columns * CELL + 40, rows * CELL + 40);

  for (let index = 0; index < sheetImage.data.length; index += 4) {
    sheetImage.data[index] = 0xed;
    sheetImage.data[index + 1] = 0xe6;
    sheetImage.data[index + 2] = 0xcc;
    sheetImage.data[index + 3] = 0xff;
  }

  COMPANIONS.forEach((companion, row) => {
    const frames = [...companion.walk, ...companion.idle];
    frames.forEach((parts, column) => {
      const image = scale(buildFrame(companion, parts), ZOOM);
      blit(sheetImage, image, 20 + column * CELL, 20 + row * CELL + (CELL - image.height));
    });
  });

  const outPath = join(import.meta.dir, "..", "..", "art", "proof-companions.png");
  await Bun.write(outPath, encodePng(sheetImage));
  console.info(`wrote ${outPath}`);
}
