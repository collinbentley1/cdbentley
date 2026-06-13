import { type Prim, renderSprite, type SpriteSpec } from "./render.ts";

/**
 * High-fidelity companions, built from shaded SDF primitives so they catch
 * light like the hand-painted horse. Each companion is a function of a pose
 * phase (0..3 for the 4-frame walk; idle uses a gentle 2-frame breath), so
 * animation is just re-posing the primitives per frame.
 */

export type HiCompanion = {
  name: string;
  width: number;
  height: number;
  walk: SpriteSpec[];
  idle: SpriteSpec[];
};

const ease = (phase: number): number => Math.sin((phase / 4) * Math.PI * 2);

// ---------------------------------------------------------------- bulldog ---

const BULLDOG_MATS = {
  ear: { ramp: ["#3a2616", "#5b3c22", "#724c2c", "#8a5e38"] },
  fawn: { ramp: ["#6b5a3c", "#897150", "#a68d64", "#c2a87e", "#dcc79c", "#efe2c2"], specular: false },
  nose: { ramp: ["#1c1a20", "#2b2b33", "#3d3640"], flat: false },
  saddle: { ramp: ["#3a2616", "#5b3c22", "#7a5230", "#9a6a3c", "#b5824c"] },
};

function bulldogFrame(legSwing: number, bob: number): SpriteSpec {
  const baseY = 42 - bob;
  // Short, thick, wide-set legs (a bulldog stands low and planted).
  const leg = (x: number, swing: number): Prim => ({ ax: x, ay: baseY - 5, bx: x + swing, by: baseY, kind: "capsule", mat: "fawn", r: 4 });
  return {
    decals: [
      // brow + eye
      { grid: "###\n#o.", palette: { "#": "#2b2b33", o: "#d8d2c0" }, x: 46, y: 18 - bob },
      // jowl wrinkle under the eye
      { grid: "w", palette: { w: "#8a7450" }, x: 50, y: 24 - bob },
    ],
    height: 48,
    materials: BULLDOG_MATS,
    prims: [
      // legs — wide stance, fronts planted forward
      leg(18, -legSwing),
      leg(28, legSwing),
      leg(44, legSwing * 0.7),
      leg(52, -legSwing * 0.7),
      // stubby tail
      { ax: 8, ay: 26 - bob, bx: 4, by: 22 - bob, kind: "capsule", mat: "fawn", r: 2.2 },
      // torso — low and wide, hindquarters narrower than the chest
      { kind: "ellipse", mat: "fawn", rx: 18, ry: 11, x: 25, y: 29 - bob },
      // broad chest, set forward and low
      { kind: "ellipse", mat: "fawn", rx: 13, ry: 13, x: 43, y: 30 - bob },
      // brown saddle — flush color patch inside the back, no silhouette hump
      { bias: 6, kind: "ellipse", mat: "saddle", rx: 14, ry: 4.5, x: 23, y: 23 - bob },
      // big blocky head, the bulldog's defining mass
      { kind: "rect", mat: "fawn", round: 7, rx: 12, ry: 11, x: 50, y: 25 - bob },
      // folded rose ear flat on the skull
      { bias: 4, kind: "rect", mat: "ear", round: 2, rx: 4, ry: 3, x: 46, y: 17 - bob },
      // muzzle block
      { bias: 2, kind: "rect", mat: "fawn", round: 3, rx: 7, ry: 6, x: 57, y: 28 - bob },
      // protruding lower jaw (the underbite) juts past the muzzle
      { bias: 7, kind: "rect", mat: "fawn", round: 2, rx: 5, ry: 3, x: 60, y: 31 - bob },
      // nose
      { bias: 10, kind: "rect", mat: "nose", round: 2, rx: 2.6, ry: 2.2, x: 63, y: 27 - bob },
    ],
    roundness: 6,
    shadow: { rx: 27, ry: 4, x: 32, y: 46 },
    width: 70,
  };
}

export const BULLDOG_HI: HiCompanion = {
  height: 48,
  idle: [bulldogFrame(0, 0), bulldogFrame(0, 1)],
  name: "bulldog",
  walk: [bulldogFrame(4, 0), bulldogFrame(0, 1), bulldogFrame(-4, 0), bulldogFrame(0, 1)],
  width: 70,
};

// ------------------------------------------------------------------ robot ---

const ROBOT_MATS = {
  antenna: { ramp: ["#2b2b33", "#3d3640", "#54505e"] },
  // Warm off-white (not stark white) so the robot joins the parchment scene
  // instead of stealing the anchor from the horse.
  metal: { ramp: ["#7e765f", "#998f74", "#b3a988", "#c8be9e", "#dcd2b4", "#ece2c6"], specular: true },
  screen: { ramp: ["#16222a", "#1c2e38", "#244049"] },
  tread: { ramp: ["#1c1a20", "#2b2b33", "#3d3640", "#54505e"] },
};

// Heart emblem as an actual heart shape (lit left lobe), so it never reads
// as a mouth. `b` bright, `d` deep, `o` edge.
const HEART_DECAL = {
  grid: ".oo.oo.\nobbdddo\nobbddddo\n.odddd o\n..oddo..\n...oo...",
  palette: { b: "#e0746a", d: "#c24b41", o: "#8f352d" },
};

function robotFrame(roll: number, bob: number, heartBright: boolean): SpriteSpec {
  const hp = heartBright ? { b: "#f0a89e", d: "#d6584c", o: "#a03b32" } : HEART_DECAL.palette;
  return {
    decals: [
      // round screen face with two soft eyes — lives on the HEAD, not the body
      { grid: ".cc..cc.", palette: { c: "#8fe0d8" }, x: 18, y: 14 - bob },
      // chest heart emblem
      { grid: HEART_DECAL.grid, palette: hp, x: 23, y: 33 - bob },
    ],
    height: 60,
    light: { x: -0.5, y: -0.78, z: 0.5 },
    materials: ROBOT_MATS,
    prims: [
      // tread base
      { kind: "rect", mat: "tread", round: 5, rx: 13, ry: 5, x: 27 + roll, y: 53 - bob },
      // little side arms
      { kind: "capsule", mat: "metal", r: 2.6, ax: 14, ay: 38 - bob, bx: 10, by: 44 - bob },
      { kind: "capsule", mat: "metal", r: 2.6, ax: 40, ay: 38 - bob, bx: 44, by: 44 - bob },
      // torso (rounded, holds the heart)
      { kind: "rect", mat: "metal", round: 9, rx: 14, ry: 13, x: 27, y: 38 - bob },
      // neck
      { kind: "rect", mat: "metal", round: 2, rx: 4, ry: 3, x: 27, y: 25 - bob },
      // head dome
      { kind: "rect", mat: "metal", round: 9, rx: 12, ry: 10, x: 27, y: 16 - bob },
      // screen face (inset, dark) on the head
      { bias: 7, kind: "rect", mat: "screen", round: 4, rx: 9, ry: 6, x: 27, y: 16 - bob },
      // antenna
      { kind: "capsule", mat: "antenna", r: 1.3, ax: 27, ay: 7 - bob, bx: 27, by: 2 - bob },
    ],
    roundness: 9,
    shadow: { rx: 19, ry: 4, x: 27, y: 57 },
    width: 56,
  };
}

export const ROBOT_HI: HiCompanion = {
  height: 58,
  idle: [robotFrame(0, 0, false), robotFrame(0, 1, true)],
  name: "robot",
  walk: [robotFrame(-2, 0, true), robotFrame(0, 1, false), robotFrame(2, 0, true), robotFrame(0, 1, false)],
  width: 56,
};

// ----------------------------------------------------------------- pigeon ---

const PIGEON_MATS = {
  beak: { ramp: ["#9a6a1e", "#c08a2e", "#d9a441", "#ecc060"] },
  body: { ramp: ["#3a3e47", "#4c515b", "#646a76", "#828896", "#a4aab4", "#c6ccd4"], specular: false },
  leg: { ramp: ["#7a3a32", "#9a4a3e", "#b8543f"] },
};

function pigeonFrame(legSwing: number, headDx: number, bob: number): SpriteSpec {
  return {
    decals: [
      // iridescent neck patch
      { grid: "tp\npt", palette: { p: "#7e5e8c", t: "#4f8c7e" }, x: 30, y: 16 - bob },
      // eye
      { grid: "e", palette: { e: "#16161e" }, x: 35 + headDx, y: 12 - bob },
      // stethoscope: tube + chestpiece
      { grid: "R..R\n.RR.\n.SS.", palette: { R: "#b8543f", S: "#c8ccd2" }, x: 26, y: 18 - bob },
    ],
    height: 40,
    materials: PIGEON_MATS,
    prims: [
      // legs
      { ax: 20, ay: 30 - bob, bx: 18 - legSwing, by: 37, kind: "capsule", mat: "leg", r: 1.5 },
      { ax: 26, ay: 30 - bob, bx: 28 + legSwing, by: 37, kind: "capsule", mat: "leg", r: 1.5 },
      // tail
      { ax: 14, ay: 20 - bob, bx: 3, by: 16 - bob, kind: "capsule", mat: "body", r: 3.5 },
      // body
      { kind: "ellipse", mat: "body", rx: 13, ry: 10, x: 22, y: 20 - bob },
      // neck/head
      { kind: "capsule", mat: "body", r: 5, ax: 30, ay: 18 - bob, bx: 34 + headDx, by: 12 - bob },
      { kind: "circle", mat: "body", r: 6, x: 35 + headDx, y: 11 - bob },
      // beak
      { bias: 4, kind: "capsule", mat: "beak", r: 1.8, ax: 40 + headDx, ay: 11 - bob, bx: 45 + headDx, by: 12 - bob },
    ],
    roundness: 6,
    shadow: { rx: 17, ry: 3, x: 23, y: 38 },
    width: 50,
  };
}

export const PIGEON_HI: HiCompanion = {
  height: 40,
  idle: [pigeonFrame(0, 0, 0), pigeonFrame(0, 1, 1)],
  name: "pigeon",
  walk: [pigeonFrame(3, 1, 0), pigeonFrame(0, 0, 1), pigeonFrame(-3, -1, 0), pigeonFrame(0, 0, 1)],
  width: 50,
};

// ------------------------------------------------------------------- pear ---

const PEAR_MATS = {
  leaf: { ramp: ["#3a5220", "#4f6b2c", "#5c8c37", "#74a046", "#8fb85e", "#a8cc70"] },
  leg: { ramp: ["#22202a", "#33313d", "#4a4754"] },
  // Muted olive-green (desaturated ~20%, value dropped) so the pear sits in
  // the parade instead of drawing the eye off the horse — wide range + specular.
  pear: { ramp: ["#36441c", "#4a5a26", "#5e7034", "#748744", "#8c9c5a", "#a6b474", "#c2cc92"], specular: true },
  stem: { ramp: ["#4a3018", "#6b4426", "#8a5a33"] },
};

function pearFrame(legSwing: number, lean: number, bob: number): SpriteSpec {
  return {
    decals: [
      // freckles ride the lower-right shadow side
      { grid: "f", palette: { f: "#739330" }, x: 21 + lean, y: 36 - bob },
      { grid: "f", palette: { f: "#739330" }, x: 24 + lean, y: 31 - bob },
    ],
    height: 50,
    light: { x: -0.6, y: -0.7, z: 0.5 },
    materials: PEAR_MATS,
    prims: [
      // legs
      { ax: 14, ay: 43 - bob, bx: 13 - legSwing, by: 47, kind: "capsule", mat: "leg", r: 1.9 },
      { ax: 21, ay: 43 - bob, bx: 22 + legSwing, by: 47, kind: "capsule", mat: "leg", r: 1.9 },
      // pear body: a smooth taper (neck → shoulders → belly), not a snowman
      { kind: "circle", mat: "pear", r: 6.5, x: 17 + lean, y: 21 - bob },
      { kind: "circle", mat: "pear", r: 10, x: 17 + Math.round(lean / 2), y: 28 - bob },
      { kind: "circle", mat: "pear", r: 12.5, x: 17, y: 36 - bob },
      // stem
      { kind: "capsule", mat: "stem", r: 1.6, ax: 18 + lean, ay: 14 - bob, bx: 20 + lean, by: 8 - bob },
      // leaf
      { bias: 3, kind: "ellipse", mat: "leaf", rx: 5, ry: 2.6, x: 25 + lean, y: 9 - bob },
    ],
    roundness: 10,
    shadow: { rx: 15, ry: 3, x: 17, y: 48 },
    width: 38,
  };
}

export const PEAR_HI: HiCompanion = {
  height: 50,
  idle: [pearFrame(0, 0, 0), pearFrame(0, 0, 1)],
  name: "pear",
  walk: [pearFrame(4, 2, 0), pearFrame(0, 0, 2), pearFrame(-4, -2, 0), pearFrame(0, 0, 2)],
  width: 38,
};

// ------------------------------------------------------------------ crane ---
// A flying red-crowned crane (丹顶鹤) — white body, black flight feathers, red
// crown. Reads "Beijing" with far more grace than the old origami goose.

const CRANE_MATS = {
  beak: { ramp: ["#2b2b33", "#3d3640"] },
  black: { ramp: ["#16161e", "#22202a", "#33313d", "#46434f"] },
  crown: { flat: true, ramp: ["#c24b41"] },
  // Charcoal legs with a lit grey edge so they stay grounded at small sizes.
  leg: { ramp: ["#16161e", "#2b2b33", "#46434f", "#6b6776"] },
  white: { ramp: ["#9aa0a8", "#bcc0c4", "#d4d6d6", "#e8e8e2", "#f5f4ee", "#fdfdf8"], specular: false },
};

function craneFrame(stride: number, headDx: number, bob: number): SpriteSpec {
  return {
    decals: [{ grid: "e", palette: { e: "#16161e" }, x: 40 + headDx, y: 9 - bob }],
    height: 60,
    materials: CRANE_MATS,
    prims: [
      // long striding legs (toe joint kink) — thickened so a lit edge survives
      { ax: 22, ay: 32 - bob, bx: 20 + stride, by: 44, kind: "capsule", mat: "leg", r: 2 },
      { ax: 20 + stride, ay: 44, bx: 22 + stride, by: 54, kind: "capsule", mat: "leg", r: 1.8 },
      { ax: 26, ay: 32 - bob, bx: 28 - stride, by: 44, kind: "capsule", mat: "leg", r: 2 },
      { ax: 28 - stride, ay: 44, bx: 26 - stride, by: 54, kind: "capsule", mat: "leg", r: 1.8 },
      // body
      { kind: "ellipse", mat: "white", rx: 12, ry: 8, x: 24, y: 26 - bob },
      // black tail bustle draping at the rear (iconic red-crowned crane)
      { bias: 6, kind: "ellipse", mat: "black", rx: 6, ry: 5, x: 12, y: 27 - bob },
      { bias: 6, kind: "capsule", mat: "black", r: 2, ax: 14, ay: 28 - bob, bx: 6, by: 33 - bob },
      // S-curved neck up to the head
      { kind: "capsule", mat: "white", r: 2.8, ax: 30, ay: 22 - bob, bx: 34, by: 14 - bob },
      { kind: "capsule", mat: "white", r: 2.6, ax: 34, ay: 14 - bob, bx: 38 + headDx, by: 9 - bob },
      // head
      { kind: "circle", mat: "white", r: 3.4, x: 39 + headDx, y: 8 - bob },
      // beak
      { bias: 4, kind: "capsule", mat: "beak", r: 1.2, ax: 42 + headDx, ay: 8 - bob, bx: 48 + headDx, by: 8 - bob },
      // red crown cap
      { bias: 9, kind: "ellipse", mat: "crown", rx: 2.6, ry: 2, x: 39 + headDx, y: 5 - bob },
    ],
    roundness: 5,
    shadow: { rx: 13, ry: 3, x: 24, y: 55 },
    width: 56,
  };
}

export const CRANE_HI: HiCompanion = {
  height: 60,
  idle: [craneFrame(0, 0, 0), craneFrame(0, 1, 1)],
  name: "crane",
  walk: [craneFrame(5, 1, 0), craneFrame(0, 0, 1), craneFrame(-5, -1, 0), craneFrame(0, 0, 1)],
  width: 56,
};

export const HI_COMPANIONS = [CRANE_HI, BULLDOG_HI, ROBOT_HI, PIGEON_HI, PEAR_HI];

if (import.meta.main) {
  const { createImage, encodePng } = await import("./png.ts");
  const { blit, scale } = await import("./pixel.ts");
  const cell = 72 * 3;
  const proof = createImage(cell * 6 + 20, cell * HI_COMPANIONS.length + 20);
  for (let i = 0; i < proof.data.length; i += 4) {
    proof.data[i] = 0xed;
    proof.data[i + 1] = 0xe6;
    proof.data[i + 2] = 0xcc;
    proof.data[i + 3] = 0xff;
  }
  HI_COMPANIONS.forEach((c, row) => {
    [...c.walk, ...c.idle].forEach((f, col) => {
      const img = scale(renderSprite(f), 3);
      blit(proof, img, 10 + col * cell, 10 + row * cell + (cell - img.height));
    });
  });
  await Bun.write(new URL("../../art/proof-companions-hi.png", import.meta.url).pathname, encodePng(proof));
  console.info("wrote art/proof-companions-hi.png");
}
