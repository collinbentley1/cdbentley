import { type Prim, renderSprite } from "./render.ts";
import { type Image } from "./png.ts";

/**
 * Shaded scenery for the rounded, volumetric forms the SDF renderer handles
 * best (rocks, bushes, the aspen's globe crown). Conifers stay on the crisp
 * dithered path in scenery.ts — tiered needles fight rounded shading. Native
 * sizes match the flat originals so the client's scenery metadata is unchanged.
 */

const FOLIAGE = { dark: "#3a4a24", light: "#7a8a4e", lighter: "#94a25e", mid: "#5c6b3c" };

export function buildRockHi(): Image {
  return renderSprite({
    height: 8,
    materials: { stone: { ramp: ["#46433a", "#565247", "#5f5a4e", "#787264", "#8c8678", "#a39d8c", "#bdb6a2"] } },
    prims: [{ kind: "ellipse", mat: "stone", rx: 6.5, ry: 3.4, x: 7.5, y: 4.5 } as Prim],
    roundness: 3,
    shadow: null,
    width: 15,
  });
}

export function buildBushHi(): Image {
  return renderSprite({
    height: 12,
    materials: { leaf: { ramp: ["#2e3c1c", "#3a4a24", "#4c5c2e", FOLIAGE.mid, FOLIAGE.light, FOLIAGE.lighter] } },
    prims: [
      { kind: "ellipse", mat: "leaf", rx: 4, ry: 3.5, x: 5, y: 8 },
      { kind: "ellipse", mat: "leaf", rx: 5, ry: 4.5, x: 10, y: 7 },
      { kind: "ellipse", mat: "leaf", rx: 4, ry: 3.5, x: 15, y: 8 },
    ] as Prim[],
    roundness: 4,
    shadow: null,
    width: 20,
  });
}

export function buildAspenHi(): Image {
  return renderSprite({
    height: 32,
    materials: {
      crown: { ramp: ["#6e6420", "#897a28", "#a08c34", "#bca546", "#d2bc5e", "#e6d27e"], specular: false },
      trunk: { ramp: ["#9a8f72", "#b8ad8c", "#d2c8a6", "#e6dcc0"] },
    },
    prims: [
      { kind: "capsule", mat: "trunk", r: 1.6, ax: 11, ay: 32, bx: 11, by: 17 } as Prim,
      { kind: "ellipse", mat: "crown", rx: 9, ry: 9, x: 11, y: 11 },
      { kind: "ellipse", mat: "crown", rx: 5.5, ry: 5.5, x: 5, y: 14 },
      { kind: "ellipse", mat: "crown", rx: 5.5, ry: 5.5, x: 17, y: 14 },
    ] as Prim[],
    roundness: 7,
    shadow: null,
    width: 22,
  });
}
