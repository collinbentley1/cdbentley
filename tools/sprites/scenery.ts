import { fromGrid, hexToRgba, setPixel } from "./pixel.ts";
import { createImage, type Image } from "./png.ts";

/**
 * Trail scenery for the journey (10x visual pass). Mostly procedural — regular
 * organic shapes (trees, ridges, skylines, clouds) generate cleaner and more
 * consistently than hand grids, with deterministic dither so builds are stable.
 * Palette stays in the parchment world: olive foliage, warm wood, muted golds.
 */

const INK = "#2b2b33";

const FOLIAGE = { dark: "#3f4a2e", light: "#7a8a4e", lighter: "#94a25e", mid: "#5c6b3c" };
const WOOD = { dark: "#5b4226", light: "#9a7848", mid: "#7a5a36" };
const STONE = { dark: "#5f5a4e", light: "#b2ac9c", mid: "#8c8678", moss: "#6b7a4a" };

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = (h ^ (h >> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return ((h ^ (h >> 16)) >>> 0) % 1000;
}

// ---------------------------------------------------------------- trees ---

/** Pine: stacked, slightly ragged triangles with dithered light on the sun side. */
export function buildPine(height = 36, seed = 1): Image {
  const width = Math.round(height * 0.62);
  const image = createImage(width, height);
  const ink = hexToRgba(INK);
  const trunkX = Math.floor(width / 2);
  const tiers = 4;
  const canopyHeight = height - 6;

  for (let y = 2; y < canopyHeight; y += 1) {
    const t = (y - 2) / (canopyHeight - 2);
    const tier = Math.min(tiers - 1, Math.floor(t * tiers));
    const tierT = t * tiers - tier;
    const half = Math.max(1, Math.round(((tier + 0.35 + tierT * 0.9) / tiers) * (width / 2 - 1)));
    for (let dx = -half; dx <= half; dx += 1) {
      const x = trunkX + dx;
      const edge = Math.abs(dx) === half;
      const ragged = edge && hash(x, y, seed) % 4 === 0;
      if (ragged) {
        continue;
      }
      let color = FOLIAGE.mid;
      if (edge || y === 2) {
        color = INK;
      } else if (dx < -half + 2 + (hash(x, y, seed + 1) % 2)) {
        color = FOLIAGE.light;
      } else if (dx > half - 3) {
        color = FOLIAGE.dark;
      } else if (hash(x, y, seed + 2) % 11 === 0) {
        color = FOLIAGE.dark;
      } else if (hash(x, y, seed + 3) % 13 === 0) {
        color = FOLIAGE.light;
      }
      setPixel(image, x, y, hexToRgba(color));
    }
  }
  // Trunk + root flare.
  for (let y = canopyHeight; y < height; y += 1) {
    setPixel(image, trunkX - 2, y, ink);
    setPixel(image, trunkX - 1, y, hexToRgba(WOOD.mid));
    setPixel(image, trunkX, y, hexToRgba(WOOD.light));
    setPixel(image, trunkX + 1, y, ink);
  }
  setPixel(image, trunkX - 3, height - 1, ink);
  setPixel(image, trunkX + 2, height - 1, ink);
  return image;
}

/** Aspen: pale trunk, loose golden-olive crown — reads autumnal at dusk. */
export function buildAspen(height = 32, seed = 2): Image {
  const width = Math.round(height * 0.68);
  const image = createImage(width, height);
  const ink = hexToRgba(INK);
  const cx = Math.floor(width / 2);
  const crownRadius = Math.floor(width / 2) - 1;
  const crownCy = crownRadius + 1;

  for (let y = 0; y < crownCy + crownRadius; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = (y - crownCy) * 1.15;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const wobble = (hash(x, y, seed) % 3) - 1;
      if (distance + wobble * 0.6 > crownRadius) {
        continue;
      }
      let color = "#a08c3e";
      if (distance + wobble * 0.6 > crownRadius - 1.2) {
        color = INK;
      } else if (dx < -crownRadius * 0.25 && hash(x, y, seed + 1) % 3 !== 0) {
        color = "#bfa84e";
      } else if (dx > crownRadius * 0.3 || hash(x, y, seed + 2) % 9 === 0) {
        color = "#7d6e32";
      }
      setPixel(image, x, y, hexToRgba(color));
    }
  }
  for (let y = crownCy + crownRadius - 2; y < height; y += 1) {
    setPixel(image, cx - 1, y, ink);
    setPixel(image, cx, y, hexToRgba("#d8cdaf"));
    setPixel(image, cx + 1, y, ink);
    if (hash(0, y, seed) % 3 === 0) {
      setPixel(image, cx, y, hexToRgba("#9a8f72"));
    }
  }
  return image;
}

export function buildBush(seed = 3): Image {
  const width = 20;
  const height = 12;
  const image = createImage(width, height);
  const lobes: Array<[number, number, number]> = [
    [5, 7, 4],
    [10, 5, 5],
    [15, 7, 4],
  ];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let inside = false;
      let edge = false;
      for (const [lx, ly, r] of lobes) {
        const d = Math.sqrt((x - lx) ** 2 + ((y - ly) * 1.3) ** 2);
        if (d <= r) {
          inside = true;
          if (d > r - 1.1) {
            edge = true;
          }
        }
      }
      if (!inside || y === height - 1) {
        continue;
      }
      let color = FOLIAGE.mid;
      if (edge) {
        color = INK;
      } else if (y < 4 && hash(x, y, seed) % 3 !== 0) {
        color = FOLIAGE.light;
      } else if (y > 7 || hash(x, y, seed + 1) % 9 === 0) {
        color = FOLIAGE.dark;
      }
      setPixel(image, x, y, hexToRgba(color));
    }
  }
  return image;
}

export function buildRock(seed = 4): Image {
  return fromGrid(
    `
.....oooo......
...oolllloo....
..ollllllmmo...
.ollllmmmmmdo..
.olmmmmmmddro..
ommmmmmdddddo..
ommmddddddddro.
.oooooooooooo..
`,
    { d: STONE.dark, l: STONE.light, m: STONE.mid, o: INK, r: STONE.moss },
  );
}

export function buildFlowers(): Image {
  return fromGrid(
    `
..r......g.....
.rrr..g.ggg..r.
..r..ggg.g..rrr
.sgs..g.sgs..r.
..s..sgs.s..sgs
..s...s..s...s.
`,
    { g: "#d9a441", r: "#c24b41", s: "#5c6b3c" },
  );
}

/** Tiny grass tuft for trail verges — three variants keep scatter from tiling. */
export function buildGrassTuft(seed = 0): Image {
  const grids = [
    `
.s...s..s.
s.s.s.ss.s
sssssssssss
`,
    `
..s..s....
s.sss.s.s.
ssssssssss
`,
    `
...s...s..
.s.s.s.ss.
.ssssssss.
`,
  ];
  return fromGrid(grids[seed % grids.length] ?? grids[0]!, { s: FOLIAGE.mid });
}

export function buildPebble(seed = 0): Image {
  const grids = [
    `
.oo.
ollo
omdo
.oo.
`,
    `
.ooo.
olllo
ommdo
.ooo.
`,
  ];
  return fromGrid(grids[seed % grids.length] ?? grids[0]!, { d: STONE.dark, l: STONE.light, m: STONE.mid, o: INK });
}

/** A faint distant tree silhouette for the far backdrop band (depth). */
export function buildFarTree(seed = 0): Image {
  const width = 10;
  const height = 16;
  const image = createImage(width, height);
  const tone = hexToRgba("#8c9472");
  const cx = Math.floor(width / 2);
  for (let y = 0; y < height - 3; y += 1) {
    const t = y / (height - 3);
    const half = Math.max(0, Math.round(t * (width / 2 - 1)));
    for (let dx = -half; dx <= half; dx += 1) {
      if (half > 0 && Math.abs(dx) === half && hash(dx, y, seed) % 3 === 0) {
        continue;
      }
      setPixel(image, cx + dx, y, tone);
    }
  }
  for (let y = height - 3; y < height; y += 1) {
    setPixel(image, cx, y, tone);
  }
  return image;
}

export function buildCattails(): Image {
  return fromGrid(
    `
....b......b....
....b...b..b....
.b..s...b..s..b.
.s..s...s..s..s.
.s...s..s..s..s.
..s..s.s..s..s..
..s..s.s..s.s...
...s.s.s..s.s...
...s.ss...ss....
....sss...ss....
`,
    { b: "#7a5a36", s: "#6b7a4a" },
  );
}

// ----------------------------------------------------------- structures ---

export function buildFence(): Image {
  const width = 36;
  const height = 18;
  const image = createImage(width, height);
  const ink = hexToRgba(INK);
  const mid = hexToRgba(WOOD.mid);
  const light = hexToRgba(WOOD.light);
  // Posts.
  for (const px of [2, 17, 32]) {
    for (let y = 2; y < height; y += 1) {
      setPixel(image, px - 1, y, ink);
      setPixel(image, px, y, y < 4 ? ink : mid);
      setPixel(image, px + 1, y, ink);
    }
    setPixel(image, px, 2, ink);
  }
  // Rails.
  for (const ry of [6, 11]) {
    for (let x = 0; x < width; x += 1) {
      setPixel(image, x, ry, ink);
      setPixel(image, x, ry + 1, hash(x, ry, 5) % 7 === 0 ? mid : light);
      setPixel(image, x, ry + 2, ink);
    }
  }
  return image;
}

/** Collegiate gothic archway (Yale beat) — walk-through pointed arch, lamp above. */
export function buildArch(): Image {
  return fromGrid(
    `
o.ooo.ooo.ooo.ooo.o.
oooooooooooooooooooo
osssssssssssssssssso
ossssssssgssssssssso
osssssssgygsssssssso
ossssssssgssssssssso
osssssssssssssssssso
ossssssoooooosssssso
ossssoo......oosssso
osssso........osssso
ossso..........ossso
ossso..........ossso
osdso..........osdso
ossso..........ossso
ossso..........ossso
osdso..........osdso
ossso..........ossso
ossso..........ossso
osdso..........osdso
ossso..........ossso
oddso..........osddo
oooooo........oooooo
`,
    { d: "#3d3744", g: "#a87a2a", o: INK, s: "#4a4452", y: "#f0d27a" },
  );
}

export function buildLantern(): Image {
  return fromGrid(
    `
......oo......
....oogoo.....
......g.......
....ooooo.....
...orrrrro....
..orrlrrrro...
..orlrrrrro...
..orrrrrdro...
..orrrrrdro...
..orrrrddro...
...orrdddo....
....ooooo.....
......g.......
.....ggg......
`,
    { d: "#8f3a32", g: "#d9a441", l: "#e0766a", o: INK, r: "#c24b41" },
  );
}

export function buildBeaker(): Image {
  return fromGrid(
    `
...oooooo...
.....oo.....
.....oo.....
....o..o....
...o....o...
..o......o..
..o.gggg.o..
.o.gggggg.o.
.o.glgggg.o.
.o.gggggg.o.
..oooooooo..
`,
    { g: "#6f9c8f", l: "#a9c9bf", o: INK },
  );
}

// ------------------------------------------------------- horizon strips ---

/** City skyline silhouette with lit windows (NYC health years). */
export function buildSkyline(width = 110, height = 30, seed = 7): Image {
  const image = createImage(width, height);
  const ink = hexToRgba("#3a3140");
  const window = hexToRgba("#d9a441");
  let x = 0;
  while (x < width - 4) {
    const buildingWidth = 7 + (hash(x, 0, seed) % 9);
    const buildingHeight = 10 + (hash(x, 1, seed) % (height - 12));
    const top = height - buildingHeight;
    for (let bx = x; bx < Math.min(width, x + buildingWidth); bx += 1) {
      for (let y = top; y < height; y += 1) {
        setPixel(image, bx, y, ink);
      }
    }
    // Antenna on tall buildings.
    if (buildingHeight > height - 14 && hash(x, 2, seed) % 2 === 0) {
      const ax = x + Math.floor(buildingWidth / 2);
      setPixel(image, ax, top - 3, ink);
      setPixel(image, ax, top - 2, ink);
      setPixel(image, ax, top - 1, ink);
    }
    // Sparse lit windows.
    for (let wy = top + 2; wy < height - 2; wy += 3) {
      for (let wx = x + 1; wx < x + buildingWidth - 1; wx += 3) {
        if (hash(wx, wy, seed + 3) % 5 === 0) {
          setPixel(image, wx, wy, window);
        }
      }
    }
    x += buildingWidth + 1 + (hash(x, 3, seed) % 3);
  }
  return image;
}

/** Layered mountain ridge (founder beat / the long view). */
export function buildRidge(width = 128, height = 34, seed = 9): Image {
  const image = createImage(width, height);
  const back = hexToRgba("#9a917e");
  const front = hexToRgba("#6e6757");
  const snow = hexToRgba("#e8e2ce");
  const ink = hexToRgba(INK);

  const ridgeLine = (offset: number, amplitude: number, base: number) => {
    const points: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const w1 = Math.sin((x + offset) * 0.09) * amplitude;
      const w2 = Math.sin((x + offset * 2) * 0.023) * amplitude * 1.6;
      points.push(Math.round(base - w1 - w2 - (hash(x, offset, seed) % 2)));
    }
    return points;
  };

  const backLine = ridgeLine(10, 3, 14);
  const frontLine = ridgeLine(60, 4, 24);
  const backEdge = hexToRgba("#7c7464");
  for (let x = 0; x < width; x += 1) {
    const bTop = backLine[x] ?? 0;
    for (let y = bTop; y < height; y += 1) {
      setPixel(image, x, y, back);
    }
    // Hard 1px ridge edge (was a soft blend) keeps the silhouette crisp.
    setPixel(image, x, bTop, backEdge);
    if (bTop < 12) {
      setPixel(image, x, bTop + 1, snow);
    }
  }
  for (let x = 0; x < width; x += 1) {
    const top = frontLine[x] ?? height;
    for (let y = top; y < height; y += 1) {
      setPixel(image, x, y, front);
    }
    setPixel(image, x, top, ink);
  }
  return image;
}

// -------------------------------------------------------------- celestial ---

export function buildSun(): Image {
  const size = 18;
  const image = createImage(size, size);
  const c = size / 2 - 0.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
      if (d > size / 2 - 1) {
        continue;
      }
      let color = "#d9a441";
      if (d > size / 2 - 2.2) {
        color = "#b8862e";
      } else if (x - c < -1 && y - c < -1) {
        color = "#f0d27a";
      }
      setPixel(image, x, y, hexToRgba(color));
    }
  }
  return image;
}

export function buildMoon(): Image {
  const size = 16;
  const image = createImage(size, size);
  const c = size / 2 - 0.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
      const bite = Math.sqrt((x - c - 4) ** 2 + (y - c + 1) ** 2);
      if (d > size / 2 - 1 || bite < size / 2 - 2.4) {
        continue;
      }
      let color = "#e8e2ce";
      if (d > size / 2 - 2) {
        color = "#cfc9b6";
      }
      if (hash(x, y, 11) % 17 === 0) {
        color = "#cfc9b6";
      }
      setPixel(image, x, y, hexToRgba(color));
    }
  }
  return image;
}

export function buildCloud(width: number, seed: number): Image {
  const height = Math.max(12, Math.round(width * 0.45));
  const image = createImage(width, height);
  const body = hexToRgba("#f4efe0");
  const shade = hexToRgba("#e3dcc4");
  const lobeCount = Math.max(3, Math.floor(width / 11));
  const lobes: Array<[number, number, number]> = [];
  for (let index = 0; index < lobeCount; index += 1) {
    const lx = 5 + ((width - 10) / (lobeCount - 1)) * index;
    const lr = 4 + (hash(index, 0, seed) % 3) + (index === Math.floor(lobeCount / 2) ? 2 : 0);
    const ly = height - lr - 1;
    lobes.push([lx, ly, lr]);
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let inside = false;
      for (const [lx, ly, r] of lobes) {
        if (Math.sqrt((x - lx) ** 2 + ((y - ly) * 1.25) ** 2) <= r) {
          inside = true;
        }
      }
      if (!inside) {
        continue;
      }
      const flatBottom = y >= height - 2;
      setPixel(image, x, y, flatBottom || y > height - 4 ? shade : body);
    }
  }
  return image;
}

// --------------------------------------------------------------- campfire ---

export function buildCampfire(): Image[] {
  const logs = fromGrid(
    `
................
................
................
................
................
................
................
..o..........o..
.owwoooooooowwo.
owwwwwwwwwwwwwwo
.oooowwwwoooooo.
....oooooo......
`,
    { o: INK, w: WOOD.mid },
  );
  const flameFrames = [
    `
......r.........
.....rrr........
....rrgrr.......
....rggyr.......
...rggyygr......
...rgyyyygr.....
....gyyyyg......
`,
    `
........r.......
....r..rrr......
...rrr.rgr......
...rgrrggyr.....
...rggyggyr.....
....gyyyyyg.....
....gyyyyg......
`,
    `
.....r..........
....rrr....r....
....rgr...rr....
...rggrr.rgr....
...rgyygrggr....
....gyyyyyg.....
....gyyyyg......
`,
    `
................
......r.r.......
.....rrrrr......
....rrggyrr.....
...rggyyygr.....
...rgyyyyygr....
....gyyyyg......
`,
  ];
  return flameFrames.map((flame) => {
    const frame = createImage(16, 12);
    const flameImage = fromGrid(flame, { g: "#d9762e", r: "#c24b41", y: "#f0d27a" });
    for (let y = 0; y < logs.height; y += 1) {
      for (let x = 0; x < logs.width; x += 1) {
        const i = (y * logs.width + x) * 4;
        if ((logs.data[i + 3] ?? 0) > 0) {
          setPixel(frame, x, y, [logs.data[i] ?? 0, logs.data[i + 1] ?? 0, logs.data[i + 2] ?? 0, 255]);
        }
      }
    }
    for (let y = 0; y < flameImage.height; y += 1) {
      for (let x = 0; x < flameImage.width; x += 1) {
        const i = (y * flameImage.width + x) * 4;
        if ((flameImage.data[i + 3] ?? 0) > 0) {
          setPixel(frame, x, y + 1, [flameImage.data[i] ?? 0, flameImage.data[i + 1] ?? 0, flameImage.data[i + 2] ?? 0, 255]);
        }
      }
    }
    return frame;
  });
}

// ------------------------------------------------------------ dojo extras ---

export function buildCushion(red = true): Image {
  const r = red ? "#c24b41" : "#5c6b3c";
  const d = red ? "#8f3a32" : "#3f4a2e";
  const l = red ? "#d4756b" : "#7a8a4e";
  return fromGrid(
    `
....oooooooooo....
..oollllllllrroo..
.orrrrrrrrrrrrdo..
.orrrrrrrrrrdddo..
..oodddddddddoo...
....oooooooooo....
`,
    { d, l, o: INK, r },
  );
}

export function buildShojiWindow(): Image {
  const width = 30;
  const height = 26;
  const image = createImage(width, height);
  const ink = hexToRgba(INK);
  const frame = hexToRgba(WOOD.dark);
  const sky = hexToRgba("#e9ddc6");
  const ridge = hexToRgba("#9a917e");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (edge) {
        setPixel(image, x, y, ink);
      } else if (x === 1 || y === 1 || x === width - 2 || y === height - 2) {
        setPixel(image, x, y, frame);
      } else {
        setPixel(image, x, y, y > height - 9 && Math.sin(x * 0.5) * 2 + height - 7 < y ? ridge : sky);
      }
    }
  }
  // Muntin bars.
  for (let x = 2; x < width - 2; x += 1) {
    setPixel(image, x, Math.floor(height / 2), frame);
  }
  for (const mx of [Math.floor(width / 3), Math.floor((2 * width) / 3)]) {
    for (let y = 2; y < height - 2; y += 1) {
      setPixel(image, mx, y, frame);
    }
  }
  return image;
}
