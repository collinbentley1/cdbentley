import { type Prim, renderSprite } from "./render.ts";
import { type Image } from "./png.ts";

/**
 * Shaded trail cairns — stacked stones lit like the rest of the high-fidelity
 * art. Native 28×30 (displayed 2× = crisp), so the existing CSS and the
 * stone-drop animation math are unchanged.
 */

const STONE = {
  ramp: ["#403c34", "#565247", "#5f5a4e", "#787264", "#8c8678", "#a9a390", "#bdb6a2"],
};

// Stone geometry, bottom-up. Each stone leans slightly for a hand-stacked feel.
const STONES = [
  { rx: 12, ry: 5, x: 14, y: 26 },
  { rx: 9, ry: 4, x: 15, y: 18 },
  { rx: 6.5, ry: 3.5, x: 13, y: 11 },
  { rx: 4.5, ry: 3, x: 14, y: 6 },
];

function stonePrim(index: number, dy = 0): Prim {
  const s = STONES[index]!;
  return { bias: index * 0.5, kind: "ellipse", mat: "stone", rx: s.rx, ry: s.ry, x: s.x, y: s.y + dy };
}

export function buildCairnHi(count: number): Image {
  const prims = STONES.slice(0, count).map((_, i) => stonePrim(i));
  return renderSprite({ height: 30, materials: { stone: STONE }, prims, roundness: 5, shadow: { rx: 13, ry: 2.5, x: 14, y: 29 }, width: 28 });
}

/** The (count+1)th stone dropping onto a cairn of `count` stones: 3 frames. */
export function buildCairnDropHi(count: number): Image[] {
  const offsets = [-9, -4, 0];
  return offsets.map((dy) => {
    const prims = STONES.slice(0, count).map((_, i) => stonePrim(i));
    prims.push(stonePrim(count, dy));
    return renderSprite({ height: 30, materials: { stone: STONE }, prims, roundness: 5, shadow: { rx: 13, ry: 2.5, x: 14, y: 29 }, width: 28 });
  });
}
