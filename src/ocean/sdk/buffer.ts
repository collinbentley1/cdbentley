/**
 * Luminance buffer — the single currency of the Scene SDK.
 *
 * A scene is a simulation that writes values in [0, 1] into a low-res
 * row-major Float32Array. Everything downstream (ramp quantization, binning,
 * lights, the renderer) reads this shape and nothing else.
 */

export interface LuminanceBuffer {
  /** Cells per row (full-resolution grid width). */
  readonly width: number;
  /** Rows (full-resolution grid height). */
  readonly height: number;
  /** Row-major, length = width * height, values clamped by contract to [0, 1]. */
  readonly data: Float32Array;
}

export function createBuffer(width: number, height: number): LuminanceBuffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`createBuffer: width/height must be positive integers, got ${width}x${height}`);
  }

  return { data: new Float32Array(width * height), height, width };
}

export function clearBuffer(buffer: LuminanceBuffer, value = 0): void {
  buffer.data.fill(value);
}

/** Index helper; no bounds check (hot path). */
export function cellIndex(buffer: LuminanceBuffer, x: number, y: number): number {
  return y * buffer.width + x;
}

/**
 * Average-pool `source` at stride `bin` (1, 2 or 4) into a coarser buffer.
 * Output dims are ceil(width / bin) x ceil(height / bin); edge blocks average
 * only the cells that exist. bin = 1 copies.
 *
 * Pass `target` (with exactly the expected dims) to avoid allocation.
 */
export function binBuffer(source: LuminanceBuffer, bin: 1 | 2 | 4, target?: LuminanceBuffer): LuminanceBuffer {
  const outWidth = Math.ceil(source.width / bin);
  const outHeight = Math.ceil(source.height / bin);
  const out = target ?? createBuffer(outWidth, outHeight);

  if (out.width !== outWidth || out.height !== outHeight) {
    throw new Error(`binBuffer: target must be ${outWidth}x${outHeight}, got ${out.width}x${out.height}`);
  }

  const src = source.data;
  const dst = out.data;

  for (let by = 0; by < outHeight; by++) {
    const y0 = by * bin;
    const y1 = Math.min(y0 + bin, source.height);

    for (let bx = 0; bx < outWidth; bx++) {
      const x0 = bx * bin;
      const x1 = Math.min(x0 + bin, source.width);
      let sum = 0;
      let count = 0;

      for (let y = y0; y < y1; y++) {
        const row = y * source.width;
        for (let x = x0; x < x1; x++) {
          sum += src[row + x] ?? 0;
          count++;
        }
      }

      dst[by * outWidth + bx] = count > 0 ? sum / count : 0;
    }
  }

  return out;
}
