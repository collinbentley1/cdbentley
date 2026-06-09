import { deflateSync, inflateSync } from "node:zlib";

export type Rgba = Uint8ClampedArray;

export type Image = {
  width: number;
  height: number;
  data: Rgba;
};

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function createImage(width: number, height: number): Image {
  return { data: new Uint8ClampedArray(width * height * 4), height, width };
}

export function decodePng(bytes: Uint8Array): Image {
  for (let index = 0; index < SIGNATURE.length; index += 1) {
    if (bytes[index] !== SIGNATURE[index]) {
      throw new Error("not a png");
    }
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts: Uint8Array[] = [];
  let offset = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    const dataStart = offset + 8;

    if (type === "IHDR") {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      bitDepth = bytes[dataStart + 8] ?? 0;
      colorType = bytes[dataStart + 9] ?? 0;
      const interlace = bytes[dataStart + 12] ?? 0;
      if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
        throw new Error(`unsupported png: depth=${bitDepth} color=${colorType} interlace=${interlace}`);
      }
    } else if (type === "IDAT") {
      idatParts.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4;
  }

  const compressed = concat(idatParts);
  const raw = new Uint8Array(inflateSync(compressed));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const image = createImage(width, height);

  let previousRow = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const decoded = new Uint8Array(stride);

    for (let x = 0; x < stride; x += 1) {
      const rawByte = row[x] ?? 0;
      const left = x >= channels ? (decoded[x - channels] ?? 0) : 0;
      const up = previousRow[x] ?? 0;
      const upLeft = x >= channels ? (previousRow[x - channels] ?? 0) : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + left;
          break;
        case 2:
          value = rawByte + up;
          break;
        case 3:
          value = rawByte + Math.floor((left + up) / 2);
          break;
        case 4:
          value = rawByte + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`bad filter ${filter}`);
      }
      decoded[x] = value & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      image.data[target] = decoded[source] ?? 0;
      image.data[target + 1] = decoded[source + 1] ?? 0;
      image.data[target + 2] = decoded[source + 2] ?? 0;
      image.data[target + 3] = channels === 4 ? (decoded[source + 3] ?? 0) : 255;
    }

    previousRow = decoded;
  }

  return image;
}

export function encodePng(image: Image): Uint8Array {
  const stride = image.width * 4;
  const raw = new Uint8Array((stride + 1) * image.height);
  const candidate = new Uint8Array(stride);
  const best = new Uint8Array(stride);

  for (let y = 0; y < image.height; y += 1) {
    const row = image.data.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? image.data.subarray((y - 1) * stride, y * stride) : null;
    let bestFilter = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let filter = 0; filter < 5; filter += 1) {
      let score = 0;
      for (let x = 0; x < stride; x += 1) {
        const value = row[x] ?? 0;
        const left = x >= 4 ? (row[x - 4] ?? 0) : 0;
        const up = prior ? (prior[x] ?? 0) : 0;
        const upLeft = prior && x >= 4 ? (prior[x - 4] ?? 0) : 0;
        let encoded: number;
        switch (filter) {
          case 1:
            encoded = value - left;
            break;
          case 2:
            encoded = value - up;
            break;
          case 3:
            encoded = value - Math.floor((left + up) / 2);
            break;
          case 4:
            encoded = value - paeth(left, up, upLeft);
            break;
          default:
            encoded = value;
        }
        encoded &= 0xff;
        candidate[x] = encoded;
        score += encoded < 128 ? encoded : 256 - encoded;
        if (score >= bestScore) {
          break;
        }
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = filter;
        best.set(candidate);
      }
    }

    raw[y * (stride + 1)] = bestFilter;
    raw.set(best, y * (stride + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, image.width);
  ihdrView.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = new Uint8Array(deflateSync(raw, { level: 9 }));
  return concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let index = 0; index < 4; index += 1) {
    out[4 + index] = type.charCodeAt(index);
  }
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) {
    return left;
  }
  return pb <= pc ? up : upLeft;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
