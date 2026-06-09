import { createImage, type Image } from "./png.ts";

export type Palette = Record<string, string>;

export function hexToRgba(hex: string): [number, number, number, number] {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const a = value.length >= 8 ? Number.parseInt(value.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

export function fromGrid(grid: string, palette: Palette): Image {
  const rows = grid
    .split("\n")
    .map((row) => row.replace(/\s+$/, ""))
    .filter((row) => row.length > 0);
  const width = Math.max(...rows.map((row) => row.length));
  const image = createImage(width, rows.length);

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x] ?? ".";
      if (key === "." || key === " ") {
        continue;
      }
      const hex = palette[key];
      if (!hex) {
        throw new Error(`palette missing "${key}"`);
      }
      setPixel(image, x, y, hexToRgba(hex));
    }
  });

  return image;
}

export function setPixel(image: Image, x: number, y: number, rgba: [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }
  const index = (y * image.width + x) * 4;
  image.data[index] = rgba[0];
  image.data[index + 1] = rgba[1];
  image.data[index + 2] = rgba[2];
  image.data[index + 3] = rgba[3];
}

export function getPixel(image: Image, x: number, y: number): [number, number, number, number] {
  const index = (y * image.width + x) * 4;
  return [image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0, image.data[index + 3] ?? 0];
}

export function scale(image: Image, factor: number): Image {
  const out = createImage(image.width * factor, image.height * factor);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const source = (Math.floor(y / factor) * image.width + Math.floor(x / factor)) * 4;
      const target = (y * out.width + x) * 4;
      out.data[target] = image.data[source] ?? 0;
      out.data[target + 1] = image.data[source + 1] ?? 0;
      out.data[target + 2] = image.data[source + 2] ?? 0;
      out.data[target + 3] = image.data[source + 3] ?? 0;
    }
  }
  return out;
}

export function flipX(image: Image): Image {
  const out = createImage(image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      setPixel(out, image.width - 1 - x, y, getPixel(image, x, y));
    }
  }
  return out;
}

export function clone(image: Image): Image {
  return { data: new Uint8ClampedArray(image.data), height: image.height, width: image.width };
}

export function crop(image: Image, x0: number, y0: number, width: number, height: number): Image {
  const out = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = x0 + x;
      const sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) {
        continue;
      }
      setPixel(out, x, y, getPixel(image, sx, sy));
    }
  }
  return out;
}

export function blit(target: Image, source: Image, x0: number, y0: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const rgba = getPixel(source, x, y);
      if ((rgba[3] ?? 0) === 0) {
        continue;
      }
      setPixel(target, x0 + x, y0 + y, rgba);
    }
  }
}

export function fillRect(image: Image, x0: number, y0: number, width: number, height: number, hex: string): void {
  const rgba = hexToRgba(hex);
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      setPixel(image, x, y, rgba);
    }
  }
}

/** Shift a rectangular region by (dx, dy), clearing the vacated pixels. */
export function shiftRegion(image: Image, x0: number, y0: number, width: number, height: number, dx: number, dy: number): void {
  const region = crop(image, x0, y0, width, height);
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      setPixel(image, x, y, [0, 0, 0, 0]);
    }
  }
  blit(image, region, x0 + dx, y0 + dy);
}

/** Horizontal sheet of equally sized frames. */
export function sheet(frames: Image[]): Image {
  const frameWidth = Math.max(...frames.map((frame) => frame.width));
  const frameHeight = Math.max(...frames.map((frame) => frame.height));
  const out = createImage(frameWidth * frames.length, frameHeight);
  frames.forEach((frame, index) => {
    blit(out, frame, index * frameWidth + Math.floor((frameWidth - frame.width) / 2), frameHeight - frame.height);
  });
  return out;
}

/** Trim fully transparent rows from the bottom is intentionally avoided; sprites keep authored bounds. */
export function padTo(image: Image, width: number, height: number, anchorX: "left" | "center" | "right" = "center", anchorY: "top" | "middle" | "bottom" = "bottom"): Image {
  const out = createImage(width, height);
  const x0 = anchorX === "left" ? 0 : anchorX === "right" ? width - image.width : Math.floor((width - image.width) / 2);
  const y0 = anchorY === "top" ? 0 : anchorY === "middle" ? Math.floor((height - image.height) / 2) : height - image.height;
  blit(out, image, x0, y0);
  return out;
}
