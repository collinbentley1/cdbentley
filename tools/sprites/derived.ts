import { join } from "node:path";
import { blit, clone, crop, flipX, fromGrid, getPixel, hexToRgba, setPixel, shiftRegion } from "./pixel.ts";
import { decodePng, type Image } from "./png.ts";

/**
 * Sprites derived from the existing hand-made 128x128 art:
 *  - trainer idle (blink + weight shift) and wave, from trainer-front-0
 *  - horse walk cycle, idle tail-swish, and the dojo sensei (headband), from horse.png
 */

const SPRITES_DIR = join(import.meta.dir, "..", "..", "art", "sprites", "src");

async function load(name: string): Promise<Image> {
  return decodePng(new Uint8Array(await Bun.file(join(SPRITES_DIR, name)).arrayBuffer()));
}

function luminance(image: Image, x: number, y: number): number {
  const [r, g, b, a] = getPixel(image, x, y);
  if (a < 20) {
    return 999;
  }
  return 0.3 * r + 0.6 * g + 0.1 * b;
}

/** Recolor opaque dark pixels inside a box (used to clear pupils behind the glasses). */
function clearDarkWithin(image: Image, x0: number, y0: number, x1: number, y1: number, replacement: [number, number, number, number]): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (luminance(image, x, y) < 150) {
        setPixel(image, x, y, replacement);
      }
    }
  }
}

export async function buildTrainerDerived(): Promise<{ idle: Image[]; wave: Image[] }> {
  const base = await load("trainer-front-0.png");

  // Blink frame: blank both lenses to a soft glint.
  const blink = clone(base);
  const lens = getPixel(base, 50, 44);
  clearDarkWithin(blink, 49, 41, 59, 47, lens);
  clearDarkWithin(blink, 68, 41, 78, 47, lens);

  // Weight-shift frame: whole figure settles 1px.
  const settle = clone(base);
  shiftRegion(settle, 0, 0, settle.width, settle.height, 0, 1);
  const settleBlink = clone(blink);
  shiftRegion(settleBlink, 0, 0, settleBlink.width, settleBlink.height, 0, 1);

  // Wave: erase the screen-right arm, redraw raised beside the head.
  const sleeve = getPixel(base, 72, 70);
  const sleeveDark = getPixel(base, 75, 66);
  const skin = getPixel(base, 82, 89);
  const outline = getPixel(base, 88, 80);

  const armless = clone(base);
  for (let y = 61; y <= 96; y += 1) {
    for (let x = 79; x <= 90; x += 1) {
      setPixel(armless, x, y, [0, 0, 0, 0]);
    }
  }
  // Restore the torso's right outline where the sleeve used to abut it.
  for (let y = 61; y <= 90; y += 1) {
    if (luminance(armless, 78, y) < 999) {
      setPixel(armless, 79, y, outline);
    }
  }

  const wave0 = clone(armless);
  drawRaisedArm(wave0, { elbowX: 84, handY: 38, outline, skin, sleeve, sleeveDark });
  const wave1 = clone(armless);
  drawRaisedArm(wave1, { elbowX: 86, handY: 42, outline, skin, sleeve, sleeveDark });

  return { idle: [base, settle, base, blink, settleBlink], wave: [wave0, wave1] };
}

type ArmInk = {
  elbowX: number;
  handY: number;
  outline: [number, number, number, number];
  skin: [number, number, number, number];
  sleeve: [number, number, number, number];
  sleeveDark: [number, number, number, number];
};

function drawRaisedArm(image: Image, ink: ArmInk): void {
  // Upper arm from the shoulder out and up.
  const shoulder = { x: 79, y: 64 };
  const steps = 14;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const cx = Math.round(shoulder.x + (ink.elbowX + 4 - shoulder.x) * t);
    const cy = Math.round(shoulder.y + (ink.handY + 10 - shoulder.y) * t);
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        setPixel(image, cx + dx, cy + dy, Math.abs(dx) === 2 ? ink.outline : (dx + dy) % 2 ? ink.sleeve : ink.sleeveDark);
      }
    }
  }
  // Hand: open palm above the sleeve end.
  const palmX = ink.elbowX + 2;
  for (let y = ink.handY; y < ink.handY + 7; y += 1) {
    for (let x = palmX; x < palmX + 6; x += 1) {
      const edge = y === ink.handY || y === ink.handY + 6 || x === palmX || x === palmX + 5;
      setPixel(image, x, y, edge ? ink.outline : ink.skin);
    }
  }
  // Fingers hinted with outline notches on top.
  setPixel(image, palmX + 1, ink.handY - 1, ink.outline);
  setPixel(image, palmX + 3, ink.handY - 1, ink.outline);
  // Sleeve cuff under the hand.
  for (let x = palmX - 1; x < palmX + 7; x += 1) {
    setPixel(image, x, ink.handY + 7, ink.outline);
    setPixel(image, x, ink.handY + 8, ink.sleeve);
    setPixel(image, x, ink.handY + 9, ink.outline);
  }
}

type LegShift = {
  box: [number, number, number, number];
  dy: number;
  kneeY: number;
  dx: number;
};

export async function buildHorseDerived(): Promise<{ walk: Image[]; idle: Image[]; sensei: Image }> {
  const base = await load("horse.png");

  // Legs in the original (left-facing) art.
  const frontNear: LegShift = { box: [33, 100, 14, 28], dx: -2, dy: -2, kneeY: 110 };
  const backFar: LegShift = { box: [93, 100, 14, 26], dx: 2, dy: -2, kneeY: 110 };
  const frontFar: LegShift = { box: [47, 100, 13, 28], dx: -2, dy: -2, kneeY: 110 };
  const backNear: LegShift = { box: [76, 100, 15, 21], dx: 2, dy: -2, kneeY: 110 };

  const stepA = clone(base);
  applyLegShift(stepA, frontNear);
  applyLegShift(stepA, backFar);
  const stepB = clone(base);
  applyLegShift(stepB, frontFar);
  applyLegShift(stepB, backNear);

  // Companion frames face right (walking direction), so flip.
  const walk = [base, stepA, base, stepB].map(flipX);

  const swish = clone(base);
  shiftRegion(swish, 104, 70, 20, 32, 2, 1);
  const idle = [base, swish].map(flipX);

  // Sensei: right-facing horse with a red headband + trailing knot ribbons.
  const sensei = flipX(clone(base));
  const red = hexToRgba("#c24b41");
  const redDark = hexToRgba("#9a3a32");
  const inkRgba = hexToRgba("#2b2b33");
  for (let y = 24; y <= 30; y += 1) {
    for (let x = 84; x <= 120; x += 1) {
      if (luminance(sensei, x, y) === 999) {
        continue;
      }
      if (y === 24 || y === 30) {
        setPixel(sensei, x, y, inkRgba);
      } else {
        setPixel(sensei, x, y, (x + y) % 5 === 0 ? redDark : red);
      }
    }
  }
  const ribbon = fromGrid(
    `
oo......
oRRo....
.oRRo...
.oRRoo..
..oRRRo.
.oRRoo..
.oRo....
..o.....
`,
    { R: "#c24b41", o: "#2b2b33" },
  );
  blit(sensei, ribbon, 76, 26);

  return { idle, sensei, walk };
}

function applyLegShift(image: Image, leg: LegShift): void {
  const [x, y, width, height] = leg.box;
  shiftRegion(image, x, y, width, height, 0, leg.dy);
  const lowerY = leg.kneeY + leg.dy;
  const lowerHeight = y + height + leg.dy - lowerY;
  shiftRegion(image, x, lowerY, width, lowerHeight, leg.dx, 0);
}

if (import.meta.main) {
  const { createImage, encodePng } = await import("./png.ts");
  const { scale } = await import("./pixel.ts");
  const trainer = await buildTrainerDerived();
  const horse = await buildHorseDerived();
  const frames = [...trainer.idle, ...trainer.wave, ...horse.walk, ...horse.idle, horse.sensei];
  const cell = 132;
  const proof = createImage(cell * 7, cell * 2 + 8);
  for (let index = 0; index < proof.data.length; index += 4) {
    proof.data[index] = 0xed;
    proof.data[index + 1] = 0xe6;
    proof.data[index + 2] = 0xcc;
    proof.data[index + 3] = 0xff;
  }
  frames.forEach((frame, index) => {
    blit(proof, frame, (index % 7) * cell + 2, Math.floor(index / 7) * cell + 4);
  });
  await Bun.write(join(import.meta.dir, "..", "..", "art", "proof-derived.png"), encodePng(proof));
  console.info("wrote art/proof-derived.png");
}
