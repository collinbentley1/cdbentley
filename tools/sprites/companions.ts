import { type Palette } from "./pixel.ts";

/**
 * Hand-authored pixel parts for the journey companions (§6.2 of the design brief).
 * Frames are composed from parts (body + wings/legs variants) so overlapping
 * shapes never need hand-merging. All companions face right.
 */

export type Part = {
  grid: string;
  x: number;
  y: number;
};

export type CompanionArt = {
  name: string;
  palette: Palette;
  width: number;
  height: number;
  walk: Part[][];
  idle: Part[][];
};

const INK = "#2b2b33";
const PAPER = "#f7f2e4";
const PAPER_SHADE = "#d8cdaf";
const GOLD = "#d9a441";
const RED = "#c24b41";

// ---------------------------------------------------------------------------
// Paper crane (Beijing) — flap cycle: up / mid / down / mid, body bobs 1px.
// ---------------------------------------------------------------------------

const CRANE_PALETTE: Palette = {
  G: GOLD,
  R: RED,
  S: PAPER_SHADE,
  W: PAPER,
  k: "#3d3640",
  o: INK,
};

const CRANE_BODY = `
...............oRRo.....
...............oWWoGG...
...............okko.....
..............okko......
..............oko.......
.............oko........
.oo..........oko........
.oSo........oko.........
..oSo.......okWo........
...oooooooooWWWo........
..oWWWWWWWWWWWWWo.......
.oWWWWWWWWWWWWWWWo......
..oWWWWWWWWWWWSSo.......
...oWWWWWWWWWSSo........
.....okkWWWWSo..........
.......okkWo............
.........oo.............
`;

const CRANE_WING_UP = `
....oo...
...oWWo..
...oWSo..
..oWWSo..
..oWWSWo.
.oWWSWWo.
.oWWSWWWo
oWWSWWWWo
oWSWWWWSo
oWWWWWSSo
`;

const CRANE_WING_MID = `
oooo......
oSWWooo...
.oWWWWWoo.
..ooWWWWWo
....ooooo.
`;

const CRANE_WING_DOWN = `
.......oo
.....ooWo
....oWWWo
...oWWWo.
..oWWWo..
..oWWo...
.oWWo....
.oWo.....
.oo......
`;

export const CRANE: CompanionArt = {
  height: 20,
  idle: [
    [
      { grid: CRANE_BODY, x: 0, y: 1 },
      { grid: CRANE_WING_MID, x: 3, y: 7 },
    ],
    [
      { grid: CRANE_BODY, x: 0, y: 2 },
      { grid: CRANE_WING_MID, x: 3, y: 8 },
    ],
  ],
  name: "crane",
  palette: CRANE_PALETTE,
  walk: [
    [
      { grid: CRANE_BODY, x: 0, y: 2 },
      { grid: CRANE_WING_UP, x: 4, y: 0 },
    ],
    [
      { grid: CRANE_BODY, x: 0, y: 1 },
      { grid: CRANE_WING_MID, x: 3, y: 7 },
    ],
    [
      { grid: CRANE_BODY, x: 0, y: 0 },
      { grid: CRANE_WING_DOWN, x: 5, y: 10 },
    ],
    [
      { grid: CRANE_BODY, x: 0, y: 1 },
      { grid: CRANE_WING_MID, x: 3, y: 7 },
    ],
  ],
  width: 24,
};

// ---------------------------------------------------------------------------
// Bulldog (Yale) — stocky trot, brown saddle, jowly face.
// ---------------------------------------------------------------------------

const BULLDOG_PALETTE: Palette = {
  B: "#8a5a33",
  D: "#6b4426",
  N: "#3d3640",
  S: "#ddd6c2",
  T: RED,
  W: "#f2ede0",
  e: INK,
  o: INK,
  p: "#c98a7a",
};

// Taller side-view (was a 1.87:1 squashed disc) — head up-right, ear, snout,
// brown saddle, short tail; legs animate beneath.
const BULLDOG_BODY = `
.................ooo...
................oWWWo..
.........oooooooWWWWo..
........oBBBBBBoWeWWo..
.......oBBBBBBBWWWWNo..
ooooooooBBBBBBWWWWWoo..
oWWWWWWWWWWWWWWWWWWWo..
oWWWWWWWWWWWWWWWoTTWWo.
oWWWWWWWWWWWWWWWoTToWo.
.oWWSSWWWWWSSWWWWooooo.
..oooooooooooooooooo..
`;

const BULLDOG_TAIL = `
oo.
WWo
oo.
`;

const BULLDOG_LEGS_A = `
.oWWo...oWWo...oWWo..oWWo.
.oWWo...oWWo...oWWo..oWWo.
.oooo...oooo...oooo..oooo.
`;

const BULLDOG_LEGS_B = `
oWWo....oWWo..oWWo...oWWo.
.oWWo..oWWo...oWWo..oWWo..
.oooo..oooo...oooo..oooo..
`;

export const BULLDOG: CompanionArt = {
  height: 22,
  idle: [
    [
      { grid: BULLDOG_BODY, x: 0, y: 1 },
      { grid: BULLDOG_TAIL, x: 0, y: 7 },
      { grid: BULLDOG_LEGS_A, x: 1, y: 12 },
    ],
    [
      { grid: BULLDOG_BODY, x: 0, y: 2 },
      { grid: BULLDOG_TAIL, x: 0, y: 8 },
      { grid: BULLDOG_LEGS_A, x: 1, y: 13 },
    ],
  ],
  name: "bulldog",
  palette: BULLDOG_PALETTE,
  walk: [
    [
      { grid: BULLDOG_BODY, x: 0, y: 1 },
      { grid: BULLDOG_TAIL, x: 0, y: 6 },
      { grid: BULLDOG_LEGS_B, x: 1, y: 12 },
    ],
    [
      { grid: BULLDOG_BODY, x: 0, y: 2 },
      { grid: BULLDOG_TAIL, x: 0, y: 7 },
      { grid: BULLDOG_LEGS_A, x: 1, y: 13 },
    ],
    [
      { grid: BULLDOG_BODY, x: 0, y: 1 },
      { grid: BULLDOG_TAIL, x: 0, y: 6 },
      { grid: BULLDOG_LEGS_B, x: 2, y: 12 },
    ],
    [
      { grid: BULLDOG_BODY, x: 0, y: 2 },
      { grid: BULLDOG_TAIL, x: 0, y: 7 },
      { grid: BULLDOG_LEGS_A, x: 1, y: 13 },
    ],
  ],
  width: 24,
};

// ---------------------------------------------------------------------------
// Round robot with LED heart (SAR Lab) — rolls on a tread ball, heart blinks.
// ---------------------------------------------------------------------------

const ROBOT_PALETTE: Palette = {
  C: "#e8e2ce",
  E: "#f7f2e4",
  H: RED,
  K: "#3d3640",
  L: "#9a3a32",
  S: "#c9c0a4",
  o: INK,
};

const ROBOT_BODY = `
.........o..........
........oHo.........
.........o..........
.......ooooo........
.....ooCCCCCoo......
....oCCCCCCCCCo.....
...oCKKKKKKKKKCo....
...oCKEKKKKKEKCo....
...oCKKKKKKKKKCo....
...oCCCCCCCCCCCo....
..oCCCCHHCHHCCCCo...
..oCCCHHHHHHHCCCo...
..oCCCCHHHHHCCCSo...
..oSCCCCHHHCCCCSo...
...oSCCCCHCCCSSo....
....oSSCCCCCSSo.....
.....ooSSSSSoo......
`;

const ROBOT_BASE_A = `
...oKoooKoooKo..
....ooooooooo...
`;

const ROBOT_BASE_B = `
...ooKoooKooKo..
....ooooooooo...
`;

// Dim blink uses a darker red (heart powering down) — not an off-palette pink.
const ROBOT_HEART_DIM = `
.LL.LL.
LLLLLLL
.LLLLL.
..LLL..
...L...
`;

export const ROBOT: CompanionArt = {
  height: 20,
  idle: [
    [{ grid: ROBOT_BODY, x: 0, y: 1 }, { grid: ROBOT_BASE_A, x: 2, y: 18 }],
    [
      { grid: ROBOT_BODY, x: 0, y: 1 },
      { grid: ROBOT_HEART_DIM, x: 7, y: 11 },
      { grid: ROBOT_BASE_A, x: 2, y: 18 },
    ],
  ],
  name: "robot",
  palette: ROBOT_PALETTE,
  walk: [
    [{ grid: ROBOT_BODY, x: 0, y: 1 }, { grid: ROBOT_BASE_A, x: 2, y: 18 }],
    [{ grid: ROBOT_BODY, x: 0, y: 0 }, { grid: ROBOT_BASE_B, x: 2, y: 18 }],
    [{ grid: ROBOT_BODY, x: 0, y: 1 }, { grid: ROBOT_BASE_A, x: 2, y: 18 }],
    [{ grid: ROBOT_BODY, x: 0, y: 0 }, { grid: ROBOT_BASE_B, x: 2, y: 18 }],
  ],
  width: 21,
};

// ---------------------------------------------------------------------------
// Pigeon with stethoscope (NYC health years) — strut with head bob.
// ---------------------------------------------------------------------------

const PIGEON_PALETTE: Palette = {
  B: "#5e6470",
  G: GOLD,
  I: "#4f8c7e",
  P: "#7e5e8c",
  R: "#b8543f",
  S: "#c8ccd2",
  W: "#9da2a8",
  d: "#82878f",
  e: "#2b2b33",
  h: "#e8e2ce",
  o: INK,
};

const PIGEON_BODY = `
........ooo...........
.......oWWWo..........
......oWheWWo.........
......oWWWWWoGG.......
......oWIIWWo.........
.......oPIWo..........
...ooooWWWWWo.........
.ooWWWWWWWWWWo........
oBWWWWBBWWWWWWo.......
oBBWWBSSBWWWWWo.......
.oBBBBWWWWWddWo.......
..oBBBBBWWWdddo.......
...ooBBBWWWWdo........
.....ooWWWWo..........
.......oooo...........
`;

const PIGEON_STETH = `
.RRRRR....
R.....R...
.......R..
.......R..
.......R..
......oSSo
......oSSo
.......oo.
`;

const PIGEON_LEGS_A = `
..oR....oR..
..oR....oR..
.oRR...oRR..
`;

const PIGEON_LEGS_B = `
...oR..oR...
..oR....oR..
..RR...oRR..
`;

export const PIGEON: CompanionArt = {
  height: 18,
  idle: [
    [
      { grid: PIGEON_BODY, x: 0, y: 0 },
      { grid: PIGEON_STETH, x: 5, y: 4 },
      { grid: PIGEON_LEGS_A, x: 4, y: 15 },
    ],
    [
      { grid: PIGEON_BODY, x: 0, y: 1 },
      { grid: PIGEON_STETH, x: 6, y: 6 },
      { grid: PIGEON_LEGS_A, x: 4, y: 15 },
    ],
  ],
  name: "pigeon",
  palette: PIGEON_PALETTE,
  walk: [
    [
      { grid: PIGEON_BODY, x: 0, y: 0 },
      { grid: PIGEON_STETH, x: 5, y: 4 },
      { grid: PIGEON_LEGS_A, x: 4, y: 15 },
    ],
    [
      { grid: PIGEON_BODY, x: 1, y: 1 },
      { grid: PIGEON_STETH, x: 6, y: 5 },
      { grid: PIGEON_LEGS_B, x: 4, y: 15 },
    ],
    [
      { grid: PIGEON_BODY, x: 0, y: 0 },
      { grid: PIGEON_STETH, x: 5, y: 4 },
      { grid: PIGEON_LEGS_A, x: 5, y: 15 },
    ],
    [
      { grid: PIGEON_BODY, x: 1, y: 1 },
      { grid: PIGEON_STETH, x: 6, y: 5 },
      { grid: PIGEON_LEGS_B, x: 4, y: 15 },
    ],
  ],
  width: 23,
};

// ---------------------------------------------------------------------------
// Pixel pear with tiny legs (founder) — waddle.
// ---------------------------------------------------------------------------

const PEAR_PALETTE: Palette = {
  D: "#7c8c3c",
  G: "#a8b454",
  K: INK,
  L: "#5c8c37",
  T: "#6b4426",
  o: INK,
};

const PEAR_BODY = `
.........oTo......
........oTo.......
......oLLLoo......
.....oLLLLLLo.....
......ooGGoo......
......oGGGGo......
.....oGGGGGGo.....
.....oGGGGGGo.....
....oGGGGGGGGo....
...oGGKGGGGKGGo...
...oGGGGGGGGGGo...
..oGGGGGGGGGGGDo..
..oGGGGGGGGGGDDo..
..oGGGGGGGGGDDDo..
...oGGGGGGGDDDo...
....ooGGGGDDoo....
`;

const PEAR_LEGS_A = `
..oo..oo..
.oo....oo.
`;

const PEAR_LEGS_B = `
...oo.oo..
...oo..oo.
`;

export const PEAR_PAL: CompanionArt = {
  height: 19,
  idle: [
    [
      { grid: PEAR_BODY, x: 0, y: 1 },
      { grid: PEAR_LEGS_A, x: 4, y: 17 },
    ],
    [
      { grid: PEAR_BODY, x: 0, y: 2 },
      { grid: PEAR_LEGS_A, x: 4, y: 17 },
    ],
  ],
  name: "pear",
  palette: PEAR_PALETTE,
  walk: [
    [
      { grid: PEAR_BODY, x: 0, y: 1 },
      { grid: PEAR_LEGS_B, x: 4, y: 17 },
    ],
    [
      { grid: PEAR_BODY, x: 0, y: 2 },
      { grid: PEAR_LEGS_A, x: 4, y: 17 },
    ],
    [
      { grid: PEAR_BODY, x: 1, y: 1 },
      { grid: PEAR_LEGS_B, x: 5, y: 17 },
    ],
    [
      { grid: PEAR_BODY, x: 0, y: 2 },
      { grid: PEAR_LEGS_A, x: 4, y: 17 },
    ],
  ],
  width: 19,
};

export const COMPANIONS = [CRANE, BULLDOG, ROBOT, PIGEON, PEAR_PAL];
