import { rm } from "node:fs/promises";
import { join } from "node:path";
import { COMPANIONS } from "./companions.ts";
import { buildHorseDerived, buildTrainerDerived } from "./derived.ts";
import { renderText } from "./font.ts";
import { blit, fillRect, fromGrid, scale, sheet } from "./pixel.ts";
import { createImage, encodePng, type Image } from "./png.ts";
import {
  buildBubble,
  buildCairn,
  buildCairnDrop,
  buildChipFrame,
  buildDojoFloor,
  buildDojoScroll,
  buildDojoWall,
  buildDust,
  buildGrass,
  buildSignpost,
  buildSkyStrip,
  buildSlider,
  buildSpeaker,
  buildStars,
} from "./props.ts";

/** Generates every production pixel asset (§6 of the design brief). Run: bun tools/sprites/generate.ts */

const ROOT = join(import.meta.dir, "..", "..");
const SPRITES = join(ROOT, "public", "assets", "sprites");
const OG = join(ROOT, "public", "assets", "og");

const written: string[] = [];

async function write(path: string, image: Image): Promise<void> {
  await Bun.write(path, encodePng(image));
  written.push(path.replace(`${ROOT}/`, ""));
}

function buildFrameImage(width: number, height: number, parts: Array<{ grid: string; x: number; y: number }>, palette: Record<string, string>): Image {
  const frame = createImage(width, height);
  for (const part of parts) {
    blit(frame, fromGrid(part.grid, palette), part.x, part.y);
  }
  return frame;
}

// --- Companions (high-fidelity shaded renderer) -----------------------------
{
  const { HI_COMPANIONS } = await import("./companions-hi.ts");
  const { renderSprite } = await import("./render.ts");
  for (const companion of HI_COMPANIONS) {
    await write(join(SPRITES, `${companion.name}-walk.png`), sheet(companion.walk.map((f) => renderSprite(f))));
    await write(join(SPRITES, `${companion.name}-idle.png`), sheet(companion.idle.map((f) => renderSprite(f))));
  }
}
void COMPANIONS;
void buildFrameImage;

// --- Horse + sensei ----------------------------------------------------------
const horse = await buildHorseDerived();
await write(join(SPRITES, "horse-walk.png"), sheet(horse.walk));
await write(join(SPRITES, "horse-idle.png"), sheet(horse.idle));
await write(join(SPRITES, "sensei.png"), horse.sensei);

// --- Trainer idle + wave ------------------------------------------------------
const trainer = await buildTrainerDerived();
await write(join(SPRITES, "trainer-idle.png"), sheet([trainer.idle[0]!, trainer.idle[1]!, trainer.idle[3]!, trainer.idle[4]!]));
await write(join(SPRITES, "trainer-wave.png"), sheet(trainer.wave));

// --- Cairns -------------------------------------------------------------------
for (let stones = 1; stones <= 4; stones += 1) {
  await write(join(SPRITES, `cairn-${stones}.png`), buildCairn(stones));
}
for (let stones = 1; stones <= 3; stones += 1) {
  const drop = buildCairnDrop(stones);
  await write(join(SPRITES, `cairn-drop-${stones}.png`), sheet(drop));
}

// --- Props ---------------------------------------------------------------------
const dust = buildDust();
await write(join(SPRITES, "dust.png"), sheet(dust));
await write(join(SPRITES, "grass.png"), sheet(buildGrass()));
await write(join(SPRITES, "signpost.png"), buildSignpost());
const bubble = buildBubble();
await write(join(SPRITES, "bubble.png"), bubble.bubble);
await write(join(SPRITES, "bubble-tail.png"), bubble.tail);
await write(join(SPRITES, "chip.png"), buildChipFrame());
const slider = buildSlider();
await write(join(SPRITES, "slider-track.png"), slider.track);
await write(join(SPRITES, "slider-knob.png"), slider.knob);
const speaker = buildSpeaker();
await write(join(SPRITES, "speaker-on.png"), speaker.on);
await write(join(SPRITES, "speaker-off.png"), speaker.off);
const stars = buildStars();
for (const [index, star] of stars.entries()) {
  await write(join(SPRITES, `star-${index}.png`), star);
}

// --- Sky strips ------------------------------------------------------------------
await write(
  join(SPRITES, "sky-dawn.png"),
  buildSkyStrip([
    [0, "#f5e9d4"],
    [1, "#ede6cc"],
  ]),
);
await write(
  join(SPRITES, "sky-noon.png"),
  buildSkyStrip([
    [0, "#ede6cc"],
    [1, "#ede6cc"],
  ]),
);
await write(
  join(SPRITES, "sky-dusk.png"),
  buildSkyStrip([
    [0, "#dfc9bc"],
    [0.6, "#e3d2c2"],
    [1, "#ede6cc"],
  ]),
);

// --- Dojo tiles ---------------------------------------------------------------------
await write(join(SPRITES, "dojo-floor.png"), buildDojoFloor());
await write(join(SPRITES, "dojo-wall.png"), buildDojoWall());
await write(join(SPRITES, "dojo-scroll.png"), buildDojoScroll());

// --- OG images -------------------------------------------------------------------------
const ogWide = buildOgImage(1200, 630);
await write(join(OG, "og.png"), ogWide);
await write(join(OG, "og-square.png"), buildOgImage(630, 630));

// --- Favicons ------------------------------------------------------------------------------
await write(join(ROOT, "public", "favicon-32.png"), scale(buildFaviconCairn(), 2));
await write(join(ROOT, "public", "favicon-16.png"), buildFaviconCairn());

// --- Remove Nintendo trade dress -------------------------------------------------------------
await rm(join(SPRITES, "pokeball.png"), { force: true });

console.info(`${written.length} assets written`);
for (const path of written) {
  console.info(`  ${path}`);
}

function buildOgImage(width: number, height: number): Image {
  const image = createImage(width, height);

  // Dusk sky into parchment ground.
  const skyStops: Array<[number, [number, number, number]]> = [
    [0, [0xd9, 0xc2, 0xb4]],
    [0.55, [0xe3, 0xd2, 0xc2]],
    [0.72, [0xed, 0xe6, 0xcc]],
    [1, [0xe6, 0xdc, 0xbc]],
  ];
  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1);
    let from = skyStops[0]!;
    let to = skyStops[skyStops.length - 1]!;
    for (let index = 0; index < skyStops.length - 1; index += 1) {
      if (t >= skyStops[index]![0] && t <= skyStops[index + 1]![0]) {
        from = skyStops[index]!;
        to = skyStops[index + 1]!;
        break;
      }
    }
    const local = (t - from[0]) / (to[0] - from[0] || 1);
    const r = Math.round(from[1][0] + (to[1][0] - from[1][0]) * local);
    const g = Math.round(from[1][1] + (to[1][1] - from[1][1]) * local);
    const b = Math.round(from[1][2] + (to[1][2] - from[1][2]) * local);
    fillRect(image, 0, y, width, 1, `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
  }

  // Stars, deterministic scatter in the top third.
  const starSprites = buildStars();
  for (let index = 0; index < 14; index += 1) {
    const sprite = starSprites[index % starSprites.length]!;
    const x = (index * 197 + 60) % (width - 40);
    const y = ((index * 83) % Math.floor(height * 0.26)) + 14;
    blit(image, scale(sprite, 2), x, y);
  }

  const groundY = Math.floor(height * 0.78);

  // Title block.
  const isWide = width > height;
  const titleScale = isWide ? 9 : 7;
  const title = renderText("COLLIN", "#2b2b33", titleScale, 1);
  const title2 = renderText("BENTLEY", "#2b2b33", titleScale, 1);
  const subtitle = renderText("THE JOURNEY OF A TEACHER WHO BUILDS", "#5b5066", isWide ? 3 : 2, 1);
  const titleX = isWide ? 72 : Math.floor((width - title2.width) / 2);
  const titleY = isWide ? 96 : 64;
  blit(image, title, titleX, titleY);
  blit(image, title2, titleX, titleY + titleScale * 9);
  blit(image, subtitle, isWide ? titleX + 4 : Math.floor((width - subtitle.width) / 2), titleY + titleScale * 18 + 12);

  // The parade walks the ground line toward a cairn at the right.
  const cairn = scale(buildCairn(4), 4);
  blit(image, cairn, width - cairn.width - 36, groundY - cairn.height + 20);

  const companionScale = isWide ? 4 : 3;
  let cursor = width - cairn.width - 70;
  const horseImage = horse.walk[0]!;
  const horseScaled = scale(horseImage, 1);

  const trainerBase = trainer.idle[0]!;
  // Trim transparent margins of the 128x128 trainer cell for tighter layout.
  const trainerScaled = isWide ? scale(trainerBase, 2) : trainerBase;
  cursor -= isWide ? 290 : 150;
  blit(image, trainerScaled, cursor, groundY - (isWide ? 244 : 122) + 20);

  cursor -= horseScaled.width - 10;
  blit(image, horseScaled, cursor, groundY - 108);

  for (const companion of COMPANIONS) {
    const frame = buildFrameImage(companion.width, companion.height, companion.walk[0]!, companion.palette);
    const scaled = scale(frame, companionScale);
    cursor -= scaled.width + (isWide ? 26 : 12);
    if (cursor < 8) {
      break;
    }
    blit(image, scaled, cursor, groundY - scaled.height + 16);
  }

  // Ink ground line.
  fillRect(image, 0, groundY + 22, width, 3, "#2b2b33");

  return image;
}

function buildFaviconCairn(): Image {
  const image = createImage(16, 16);
  const cairn = buildCairn(3);
  // Downscale 28x30 -> 14x15 by sampling every other pixel.
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 14; x += 1) {
      const sourceIndex = (y * 2 * cairn.width + x * 2) * 4;
      const targetIndex = ((y + 1) * image.width + (x + 1)) * 4;
      image.data[targetIndex] = cairn.data[sourceIndex] ?? 0;
      image.data[targetIndex + 1] = cairn.data[sourceIndex + 1] ?? 0;
      image.data[targetIndex + 2] = cairn.data[sourceIndex + 2] ?? 0;
      image.data[targetIndex + 3] = cairn.data[sourceIndex + 3] ?? 0;
    }
  }
  return image;
}

// --- Trail scenery + celestial + dojo dressing (10x visual pass) -------------
{
  const { buildArch, buildAspen, buildBeaker, buildBush, buildCampfire, buildCattails, buildCloud, buildCushion, buildFarTree, buildFence, buildFlowers, buildGrassTuft, buildLantern, buildMoon, buildPebble, buildPine, buildRidge, buildRock, buildShojiWindow, buildSkyline, buildSun } = await import("./scenery.ts");
  await write(join(SPRITES, "pine.png"), buildPine(36, 1));
  await write(join(SPRITES, "pine-small.png"), buildPine(26, 5));
  await write(join(SPRITES, "aspen.png"), buildAspen(32, 2));
  await write(join(SPRITES, "bush.png"), buildBush());
  await write(join(SPRITES, "rock.png"), buildRock());
  await write(join(SPRITES, "flowers.png"), buildFlowers());
  await write(join(SPRITES, "cattails.png"), buildCattails());
  await write(join(SPRITES, "fence.png"), buildFence());
  await write(join(SPRITES, "arch.png"), buildArch());
  await write(join(SPRITES, "lantern.png"), buildLantern());
  await write(join(SPRITES, "beaker.png"), buildBeaker());
  await write(join(SPRITES, "skyline.png"), buildSkyline());
  await write(join(SPRITES, "ridge.png"), buildRidge());
  await write(join(SPRITES, "sun.png"), buildSun());
  await write(join(SPRITES, "moon.png"), buildMoon());
  await write(join(SPRITES, "cloud-0.png"), buildCloud(28, 1));
  await write(join(SPRITES, "cloud-1.png"), buildCloud(38, 2));
  await write(join(SPRITES, "cloud-2.png"), buildCloud(48, 3));
  await write(join(SPRITES, "campfire.png"), sheet(buildCampfire()));
  await write(join(SPRITES, "cushion-red.png"), buildCushion(true));
  await write(join(SPRITES, "cushion-green.png"), buildCushion(false));
  await write(join(SPRITES, "shoji-window.png"), buildShojiWindow());
  for (let i = 0; i < 3; i += 1) {
    await write(join(SPRITES, `grass-tuft-${i}.png`), buildGrassTuft(i));
  }
  for (let i = 0; i < 2; i += 1) {
    await write(join(SPRITES, `pebble-${i}.png`), buildPebble(i));
  }
  for (let i = 0; i < 3; i += 1) {
    await write(join(SPRITES, `far-tree-${i}.png`), buildFarTree(i));
  }
}
