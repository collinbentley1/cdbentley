/**
 * Receipt-image pipeline for the airport-gate scene.
 *
 * A "patch" is a small grayscale bitmap (luminance in [0, 1]) that the scene
 * stamps into its kiosk slot, so the image renders AS ASCII through the
 * scene's ramp, then cures into a receipt chip.
 *
 * C14 (FACTS.md): the app-directory listing screenshot IS the receipt for the
 * published-then-withdrawn ChatGPT app. That asset is Collin's and is absent
 * tonight, so the scene ships a CLEARLY-FAKE procedural placeholder that only
 * has the *shape* of a directory listing — no real content, no real text.
 *
 * TODO(collin): replace the placeholder with the real directory-listing
 * screenshot. Decode it to RGBA (Phase C can use canvas ImageData or any
 * decoder), then:
 *
 *   scalePatch(patchFromRgba(imgW, imgH, rgbaBytes, { invert: true }), slotW, slotH)
 *
 * Everything here is DOM-free and deterministic so it runs under `bun test`.
 */

export interface LuminancePatch {
  readonly width: number;
  readonly height: number;
  /** Row-major, length = width * height, values in [0, 1]. */
  readonly data: Float32Array;
}

export interface PatchFromRgbaOptions {
  /** Contrast multiplier around 0.5, applied after normalization. Default 1. */
  contrast?: number;
  /**
   * Flip black/white. Screenshots are usually dark text on a light ground;
   * the gate wants light glyphs out of the black. Default false.
   */
  invert?: boolean;
}

export function createPatch(width: number, height: number): LuminancePatch {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`createPatch: width/height must be positive integers, got ${width}x${height}`);
  }

  return { data: new Float32Array(width * height), height, width };
}

/**
 * Convert raw RGBA bytes (4 per pixel, as from ImageData) into a normalized
 * luminance patch: Rec. 709 luma, min/max stretched to [0, 1].
 */
export function patchFromRgba(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
  options: PatchFromRgbaOptions = {},
): LuminancePatch {
  const { contrast = 1, invert = false } = options;

  if (rgba.length !== width * height * 4) {
    throw new Error(`patchFromRgba: expected ${width * height * 4} bytes, got ${rgba.length}`);
  }

  const patch = createPatch(width, height);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    patch.data[i] = luma;

    if (luma < min) {
      min = luma;
    }

    if (luma > max) {
      max = luma;
    }
  }

  const span = max - min;

  for (let i = 0; i < patch.data.length; i++) {
    let v = span > 1e-6 ? ((patch.data[i] ?? 0) - min) / span : 0;

    if (invert) {
      v = 1 - v;
    }

    v = 0.5 + (v - 0.5) * contrast;
    patch.data[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
  }

  return patch;
}

/** Box-average resample (the screenshot is larger than the kiosk slot). */
export function scalePatch(source: LuminancePatch, width: number, height: number): LuminancePatch {
  const out = createPatch(width, height);

  for (let y = 0; y < height; y++) {
    const sy0 = Math.floor((y * source.height) / height);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * source.height) / height));

    for (let x = 0; x < width; x++) {
      const sx0 = Math.floor((x * source.width) / width);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * source.width) / width));
      let sum = 0;
      let count = 0;

      for (let sy = sy0; sy < sy1 && sy < source.height; sy++) {
        const row = sy * source.width;

        for (let sx = sx0; sx < sx1 && sx < source.width; sx++) {
          sum += source.data[row + sx] ?? 0;
          count++;
        }
      }

      out.data[y * width + x] = count > 0 ? sum / count : 0;
    }
  }

  return out;
}

/**
 * CLEARLY-FAKE placeholder: procedural luminance blocks with the silhouette
 * of a directory listing (header bar, permission/size/name columns, footer).
 * Zero real content — it exists only so the render->cure pipeline is complete
 * tonight. TODO(collin): swap in the real screenshot via patchFromRgba (C14).
 */
export function makeFakeDirectoryListing(width: number, height: number, seed = 1): LuminancePatch {
  const patch = createPatch(width, height);
  const rng = makeRng(seed);
  const put = (x: number, y: number, v: number): void => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      patch.data[y * width + x] = v <= 0 ? 0 : v >= 0.85 ? 0.85 : v;
    }
  };

  // Header: a path/prompt bar with word gaps.
  for (let x = 0; x < Math.floor(width * 0.55); x++) {
    put(x, 0, rng() < 0.15 ? 0 : 0.62 + (rng() - 0.5) * 0.1);
  }

  // Listing rows (row 1 and the row above the footer stay blank).
  const permsW = Math.max(4, Math.min(10, Math.floor(width * 0.16)));
  const sizeX0 = permsW + 2;
  const nameX0 = sizeX0 + 7;

  for (let y = 2; y < height - 2; y++) {
    const isDir = rng() < 0.3;

    for (let x = 0; x < permsW; x++) {
      put(x, y, (x === 0 && isDir ? 0.66 : 0.48) + (rng() - 0.5) * 0.08);
    }

    const sizeLen = 2 + Math.floor(rng() * 4);

    for (let x = 0; x < sizeLen; x++) {
      put(sizeX0 + x, y, 0.55 + (rng() - 0.5) * 0.08);
    }

    const nameLen = 4 + Math.floor(rng() * Math.max(2, width - nameX0 - 5));

    for (let x = 0; x < nameLen && nameX0 + x < width - 1; x++) {
      put(nameX0 + x, y, (isDir ? 0.75 : 0.65) + (rng() - 0.5) * 0.1);
    }
  }

  // Footer: a short summary run.
  for (let x = 0; x < Math.floor(width * 0.22); x++) {
    put(x, height - 1, 0.48 + (rng() - 0.5) * 0.08);
  }

  return patch;
}

/** Small deterministic PRNG (mulberry32-style), local to the receipt pipeline. */
function makeRng(seed: number): () => number {
  let s = seed | 0;

  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
