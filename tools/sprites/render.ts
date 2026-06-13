import { createImage, type Image } from "./png.ts";
import { hexToRgba } from "./pixel.ts";

/**
 * A small shaded-sprite renderer for high-fidelity procedural pixel art.
 *
 * Forms are built from signed-distance primitives (capsules, ellipses, circles,
 * rounded rects). The union SDF gives the silhouette; the per-pixel nearest
 * primitive gives the material; the SDF's depth + gradient give a faked rounded
 * normal that's lit by a fixed top-left key light and quantized to a per-material
 * tone ramp. A selective outline (darkened material) and optional specular dot
 * finish it. The result reads round and lit — the same vocabulary as the
 * hand-painted horse/trainer, but computed.
 */

export type Vec = { x: number; y: number };

export type Material = {
  /** Dark → light tones; brightness is quantized across these. */
  ramp: string[];
  /** Outline color; defaults to a darkened ramp[0]. */
  outline?: string;
  /** Add a bright specular bite where the surface faces the light. */
  specular?: boolean;
  /** Flat materials skip shading (LEDs, eyes) — ramp[0] used as-is. */
  flat?: boolean;
};

type Shape =
  | { kind: "circle"; x: number; y: number; r: number }
  | { kind: "capsule"; ax: number; ay: number; bx: number; by: number; r: number }
  | { kind: "ellipse"; x: number; y: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; rx: number; ry: number; round: number };

export type Prim = Shape & {
  mat: string;
  /** Bias the material-selection depth so a part sits visually in front. */
  bias?: number;
};

export type Decal = {
  /** Pixels relative to the sprite, painted last (eyes, accessories). */
  grid: string;
  x: number;
  y: number;
  palette: Record<string, string>;
};

export type SpriteSpec = {
  width: number;
  height: number;
  prims: Prim[];
  materials: Record<string, Material>;
  decals?: Decal[];
  /** Light direction toward the viewer; default top-left. */
  light?: { x: number; y: number; z: number };
  /** Roundness radius — how fast the surface domes inward from the edge. */
  roundness?: number;
  /** Soft contact shadow ellipse at the base. */
  shadow?: { x: number; y: number; rx: number; ry: number } | null;
};

function sdCircle(px: number, py: number, cx: number, cy: number, r: number): number {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdCapsule(px: number, py: number, ax: number, ay: number, bx: number, by: number, r: number): number {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

function sdEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number): number {
  // Cheap approximate SDF — accurate enough for shading and silhouette.
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  const k = Math.hypot(dx, dy);
  return (k - 1) * Math.min(rx, ry);
}

function sdRoundRect(px: number, py: number, cx: number, cy: number, rx: number, ry: number, round: number): number {
  const qx = Math.abs(px - cx) - (rx - round);
  const qy = Math.abs(py - cy) - (ry - round);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - round;
}

function sd(prim: Prim, px: number, py: number): number {
  switch (prim.kind) {
    case "circle":
      return sdCircle(px, py, prim.x, prim.y, prim.r);
    case "capsule":
      return sdCapsule(px, py, prim.ax, prim.ay, prim.bx, prim.by, prim.r);
    case "ellipse":
      return sdEllipse(px, py, prim.x, prim.y, prim.rx, prim.ry);
    case "rect":
      return sdRoundRect(px, py, prim.x, prim.y, prim.rx, prim.ry, prim.round);
  }
}

function shade(hex: string, factor: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

export function renderSprite(spec: SpriteSpec): Image {
  const { width, height, prims, materials } = spec;
  const image = createImage(width, height);
  const light = spec.light ?? { x: -0.55, y: -0.75, z: 0.45 };
  const lightLen = Math.hypot(light.x, light.y, light.z) || 1;
  const lx = light.x / lightLen;
  const ly = light.y / lightLen;
  const lz = light.z / lightLen;
  const roundness = spec.roundness ?? 7;

  const n = width * height;
  const sdf = new Float32Array(n).fill(1e9);
  const matId = new Int16Array(n).fill(-1);
  const best = new Float32Array(n).fill(1e9);

  // Union SDF + per-pixel nearest (deepest, bias-adjusted) primitive material.
  const matKeys = Object.keys(materials);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const i = py * width + px;
      for (const prim of prims) {
        const d = sd(prim, px + 0.5, py + 0.5);
        if (d < sdf[i]!) {
          sdf[i] = d;
        }
        // Material selection: deepest (most-negative) wins, with optional bias.
        const score = d - (prim.bias ?? 0);
        if (d < 0.6 && score < best[i]!) {
          best[i] = score;
          matId[i] = matKeys.indexOf(prim.mat);
        }
      }
    }
  }

  const sampleSdf = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return sdf[cy * width + cx]!;
  };

  // Contact shadow underneath, painted first.
  if (spec.shadow) {
    const s = spec.shadow;
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const dx = (px + 0.5 - s.x) / s.rx;
        const dy = (py + 0.5 - s.y) / s.ry;
        const k = dx * dx + dy * dy;
        if (k <= 1) {
          const a = Math.round(70 * (1 - k));
          paint(image, px, py, [43, 43, 51, a]);
        }
      }
    }
  }

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const i = py * width + px;
      const d = sdf[i]!;
      const mid = matId[i]!;
      if (d >= 0 || mid < 0) {
        continue;
      }
      const material = materials[matKeys[mid]!]!;
      const depth = -d;

      // Outline: boundary band → darkened material edge.
      if (depth <= 1.05) {
        const outline = material.outline ?? shade(material.ramp[0]!, 0.62);
        paint(image, px, py, hexToRgba(outline));
        continue;
      }

      if (material.flat) {
        paint(image, px, py, hexToRgba(material.ramp[0]!));
        continue;
      }

      // Faked rounded normal: in-plane points outward (SDF gradient), tilting
      // toward the viewer as the surface thickens inward.
      const gx = sampleSdf(px + 1, py) - sampleSdf(px - 1, py);
      const gy = sampleSdf(px, py + 1) - sampleSdf(px, py - 1);
      const glen = Math.hypot(gx, gy) || 1;
      const t = Math.min(1, depth / roundness);
      const dome = Math.sin((t * Math.PI) / 2); // 0 at rim → 1 deep
      let nx = (gx / glen) * (1 - dome);
      let ny = (gy / glen) * (1 - dome);
      let nz = dome + 0.12;
      const nlen = Math.hypot(nx, ny, nz) || 1;
      nx /= nlen;
      ny /= nlen;
      nz /= nlen;

      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      let brightness = 0.32 + 0.78 * diffuse;

      // Specular bite near the lit pole.
      if (material.specular && diffuse > 0.86 && depth > roundness * 0.7) {
        brightness += 0.4;
      }
      brightness = Math.max(0, Math.min(0.999, brightness));

      const ramp = material.ramp;
      const idx = Math.min(ramp.length - 1, Math.floor(brightness * ramp.length));
      paint(image, px, py, hexToRgba(ramp[idx]!));
    }
  }

  // Decals last (eyes, accessories, markings).
  for (const decal of spec.decals ?? []) {
    const rows = decal.grid.split("\n").filter((r) => r.length > 0);
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx += 1) {
        const key = row[rx]!;
        if (key === "." || key === " ") {
          continue;
        }
        const hex = decal.palette[key];
        if (hex) {
          paint(image, decal.x + rx, decal.y + ry, hexToRgba(hex));
        }
      }
    });
  }

  return image;
}

/** Alpha-composite a pixel (src over dst). */
function paint(image: Image, x: number, y: number, rgba: [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }
  const i = (y * image.width + x) * 4;
  const sa = rgba[3] / 255;
  if (sa >= 1) {
    image.data[i] = rgba[0];
    image.data[i + 1] = rgba[1];
    image.data[i + 2] = rgba[2];
    image.data[i + 3] = 255;
    return;
  }
  if (sa <= 0) {
    return;
  }
  const da = (image.data[i + 3] ?? 0) / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) {
    return;
  }
  for (let c = 0; c < 3; c += 1) {
    const src = rgba[c] ?? 0;
    const dst = image.data[i + c] ?? 0;
    image.data[i + c] = Math.round((src * sa + dst * da * (1 - sa)) / outA);
  }
  image.data[i + 3] = Math.round(outA * 255);
}
