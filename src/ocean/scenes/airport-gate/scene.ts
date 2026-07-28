/**
 * Scene 7 — "airport-gate": the gate at night, the last flight still at the
 * bridge.
 *
 * Full-bleed architecture: a floor-to-ceiling glass curtain wall — heavy
 * paired mullions on a steady module, capped with head blocks under the
 * fascia and base plates at the sill, structural transoms, a strong fascia
 * band crossing every column above, and a dense full-width sill band
 * grounding the wall like a stylobate. Beyond the glass, a huge airliner
 * nose-to-tail: a rounded nose cone with a dark cockpit notch, the two-tone
 * fuselage tube with portholes and cheatline, a foreshortened wing sweeping
 * down toward the viewer with two slung engine nacelles — dark inlets
 * forward — gear legs to the apron, the upswept tail cone, and ONE compact
 * swept tail fin with a vertical rudder seam. A floodlight pool washes the
 * apron; beyond it a dotted apron horizon, faint tarmac streaks, and two
 * distant floodlight masts give the empty bays depth; taxiway edge dots
 * recede to the right. Foreground: two committed rows of gate seats — backs,
 * cushions, legs — anchored on faint floor seams, with a walkway gap. The
 * ONE motion is the fin-tip anti-collision beacon — a slow sine pulse that
 * lifts a tiny cluster to '@' at peak and breathes a faint glow onto the
 * fin. Haze breathes only inside the glass. Pure f(time); no flicker. The
 * chapter prose beside this scene is DOM, never rendered here.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(23);

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const SKY_LUM = 0.02; // ceiling void above the fascia
const GLASS_NIGHT_LUM = 0.03; // unlit night beyond the glass
const FASCIA_EDGE_LUM = 0.62; // '=' — fascia top and soffit bands
const FASCIA_FILL_LUM = 0.52; // '|' — fascia body (survives bin 4)
const FASCIA_REVEAL_LUM = 0.4; // '-' — recessed reveal seam in the fascia
const MULLION_LUM = 0.56; // '=' — paired mullion shafts, in front of everything
const MULLION_CAP_LUM = 0.66; // '+' — head blocks and base plates
const TRANSOM_LUM = 0.58; // '=' — horizontal transoms, structural weight
const SILL_EDGE_LUM = 0.62; // '=' — sill band top edge, full width
const SILL_FILL_LUM = 0.54; // '|' — sill band body (survives bin 4)
const SILL_BASE_LUM = 0.32; // ':' — sill band under-shadow
const FLOOR_PLANE_LUM = 0.06; // polished terminal floor
const FIN_FILL_LUM = 0.64; // '=' — tail fin body (the key silhouette)
const FIN_EDGE_LUM = 0.72; // '+' — fin leading/trailing edges
const FIN_RUDDER_LUM = 0.5; // '|' — rudder hinge seam
const FUS_CROWN_LUM = 0.6; // '=' — fuselage crown line
const FUS_UPPER_LUM = 0.55; // '|' — upper fuselage tube
const FUS_CHEAT_LUM = 0.66; // '=' — cheatline at the tube centerline
const FUS_BELLY_LUM = 0.34; // ':' — darker belly
const FUS_KEEL_LUM = 0.28; // ':' — belly bottom edge
const PORTHOLE_LUM = 0.16; // '·' — dark porthole dots breaking the band
const COCKPIT_LUM = 0.14; // '·' — dark cockpit-window notch at the nose
const WING_EDGE_LUM = 0.6; // '=' — wing top surface catching the floods
const WING_FILL_LUM = 0.44; // '-' — wing underside sweeping toward the viewer
const FAIRING_LUM = 0.42; // '-' — wing-root fairing blending into the belly
const NACELLE_TOP_LUM = 0.62; // '=' — engine nacelle top highlight
const NACELLE_BODY_LUM = 0.55; // '|' — nacelle lozenge body
const NACELLE_LIP_LUM = 0.7; // '+' — inlet lip catching the floods
const NACELLE_INLET_LUM = 0.12; // '·' — dark inlet mouth
const PYLON_LUM = 0.46; // engine pylons up to the wing
const GEAR_LUM = 0.3; // landing-gear legs
const BOGIE_LUM = 0.42; // wheel bogies on the apron
const BRIDGE_LUM = 0.34; // jet-bridge corridor body
const BRIDGE_RIB_LUM = 0.42; // accordion ribs
const BRIDGE_ROOF_LUM = 0.48; // bridge roof line
const BRIDGE_CAB_LUM = 0.5; // accordion cab at the door
const POOL_MAX_LUM = 0.28; // floodlight pool peak, under the belly
const TAXI_NEAR_LUM = 0.36; // nearest taxiway edge dots
const TAXI_MID_LUM = 0.28;
const TAXI_FAR_LUM = 0.22;
const HORIZON_DOT_LUM = 0.15; // '·' — far apron edge lights
const HORIZON_BRIGHT_LUM = 0.22; // ':' — every third apron light, nearer
const TARMAC_STREAK_LUM = 0.12; // '·' — faint tarmac joints receding
const MAST_LUM = 0.28; // ':' — distant floodlight mast poles
const MAST_HEAD_LUM = 0.66; // '+' — mast lamp heads
const MAST_GLOW_LUM = 0.2; // radial glow around the lamp heads
const MULLION_REFLECT_LUM = 0.12; // mullion feet on the polished floor
const SEAT_BACK_A_LUM = 0.3; // ':' — far seat row backs
const SEAT_TOP_A_LUM = 0.36; // '-' — far seat back top edge
const SEAT_CUSHION_A_LUM = 0.24; // far seat cushions
const SEAT_LEG_A_LUM = 0.2; // far seat legs
const SEAT_BACK_B_LUM = 0.4; // '-' — near seat row backs
const SEAT_TOP_B_LUM = 0.46; // '|' — near seat back top edge
const SEAT_CUSHION_B_LUM = 0.32; // near seat cushions
const SEAT_LEG_B_LUM = 0.26; // near seat legs
const SEAT_SEAM_A_LUM = 0.12; // '·' — floor seam anchoring the far row
const SEAT_SEAM_B_LUM = 0.14; // '·' — floor seam anchoring the near row

interface GateGeometry {
  aisleHalf: number;
  beaconX: number;
  centerY: number;
  crownY: number;
  cx: number;
  fasciaTop: number;
  finTop: number;
  floorRow: number;
  glassTop: number;
  halfH: number;
  horizonRow: number;
  leadRoot: number;
  leadTip: number;
  mullionStep: number;
  noseX: number;
  poolCx: number;
  poolRx: number;
  seatRowA: number;
  seatRowB: number;
  tailX: number;
  trailRoot: number;
  trailTip: number;
  transomA: number;
  transomB: number;
  wingRootX: number;
  wingRootY: number;
  wingTipX: number;
  wingTipY: number;
}

let base = new Float32Array(0);
let baseCols = 0;
let baseRows = 0;
let hazeLattice = new Float32Array(0);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) {
    return 0;
  }

  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

/**
 * Landmarks from proportions. The curtain wall is full-bleed: the fascia
 * crosses every column, the paired-mullion grid spans the whole width, and
 * the sill band runs edge to edge. Everything scales with cols/rows so
 * small harness grids stay in-bounds.
 */
function geometry(cols: number, rows: number): GateGeometry {
  const glassTop = Math.round(rows * 0.135);
  const floorRow = Math.round(rows * 0.8);
  const glassSpan = Math.max(1, floorRow - glassTop);
  const centerY = Math.round(rows * 0.6);
  const halfH = Math.max(1, Math.round(rows * 0.055));
  const belly = centerY + halfH;

  return {
    aisleHalf: Math.max(2, Math.round(cols * 0.03)),
    beaconX: Math.round(cols * 0.858),
    centerY,
    crownY: centerY - halfH,
    cx: Math.round(cols * 0.5),
    fasciaTop: Math.max(1, Math.round(rows * 0.045)),
    finTop: Math.round(rows * 0.31),
    floorRow,
    glassTop,
    halfH,
    horizonRow: Math.round(rows * 0.44),
    leadRoot: Math.round(cols * 0.79),
    leadTip: Math.round(cols * 0.842),
    mullionStep: Math.max(8, Math.round(cols * 0.095)),
    noseX: Math.round(cols * 0.055),
    poolCx: Math.round(cols * 0.42),
    poolRx: Math.max(4, Math.round(cols * 0.3)),
    seatRowA: Math.round(rows * 0.875),
    seatRowB: Math.round(rows * 0.945),
    tailX: Math.round(cols * 0.88),
    trailRoot: Math.round(cols * 0.885),
    trailTip: Math.round(cols * 0.872),
    transomA: glassTop + Math.round(glassSpan * 0.32),
    transomB: glassTop + Math.round(glassSpan * 0.55),
    wingRootX: Math.round(cols * 0.56),
    wingRootY: belly - 2,
    wingTipX: Math.round(cols * 0.27),
    wingTipY: Math.min(rows - 1, belly + Math.max(2, Math.round(rows * 0.038))),
  };
}

/** Bounds-checked assignment (buildBase writes never wrap on small grids). */
function putSet(data: Float32Array, w: number, h: number, x: number, y: number, v: number): void {
  if (x >= 0 && x < w && y >= 0 && y < h) {
    data[y * w + x] = clamp01(v);
  }
}

/** Max-write with bounds check. */
function putMax(data: Float32Array, w: number, h: number, x: number, y: number, v: number): void {
  if (x < 0 || x >= w || y < 0 || y >= h) {
    return;
  }

  const i = y * w + x;

  if ((data[i] ?? 0) < v) {
    data[i] = clamp01(v);
  }
}

/**
 * Fuselage tube extents at column x: [yTop, yBot], or null outside the
 * hull. The nose is a quarter-ellipse (rounded cone, no staircase); the
 * tail cone upsweeps — the belly rises while the crown holds level.
 */
function tubeAt(geo: GateGeometry, cols: number, x: number): readonly [number, number] | null {
  if (x < geo.noseX || x > geo.tailX) {
    return null;
  }

  const noseLen = Math.max(4, Math.round(cols * 0.045));
  const coneLen = Math.max(4, Math.round(cols * 0.06));
  let yTop = geo.centerY - geo.halfH;
  let yBot = geo.centerY + geo.halfH;

  if (x < geo.noseX + noseLen) {
    const u = (x - geo.noseX) / noseLen;
    const half = Math.max(1, Math.round(geo.halfH * Math.sqrt(u * (2 - u))));
    yTop = geo.centerY - half;
    yBot = geo.centerY + half;
  } else if (x > geo.tailX - coneLen) {
    const v = (x - (geo.tailX - coneLen)) / coneLen;
    yBot = geo.centerY + geo.halfH - Math.round((geo.halfH * 2 - 1) * v);
  }

  return yBot < yTop ? null : [yTop, yBot];
}

/** Wing centerline row at column x (foreshortened sweep toward the viewer). */
function wingYAt(geo: GateGeometry, x: number): number {
  const span = Math.max(1, geo.wingRootX - geo.wingTipX);
  const u = (x - geo.wingTipX) / span;

  return Math.round(geo.wingTipY + (geo.wingRootY - geo.wingTipY) * u);
}

/**
 * Static architecture: the distant apron (horizon lights, tarmac streaks,
 * floodlight masts), the floodlight pool and taxiway dots, the airliner
 * (rounded nose with cockpit notch, tube, portholes, foreshortened wing,
 * two engine nacelles, gear, upswept tail cone, one compact swept fin),
 * the jet bridge, then the curtain wall drawn in front — fascia, paired
 * mullions with caps, transoms — and the sill band with the seat rows.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);
  const bellyY = geo.centerY + geo.halfH;

  // Ground: sky void, night glass, polished floor.
  for (let y = 0; y < rows; y++) {
    const v = y <= geo.glassTop ? SKY_LUM : y < geo.floorRow ? GLASS_NIGHT_LUM : FLOOR_PLANE_LUM;

    for (let x = 0; x < cols; x++) {
      putSet(base, cols, rows, x, y, v);
    }
  }

  // Distant apron: a dotted horizon of far edge lights across every bay.
  for (let x = 3; x < cols - 1; x += 7) {
    putSet(base, cols, rows, x, geo.horizonRow, x % 21 === 3 ? HORIZON_BRIGHT_LUM : HORIZON_DOT_LUM);
  }

  // Faint tarmac joint streaks receding below the horizon.
  for (const drop of [3, 6]) {
    const y = geo.horizonRow + drop;

    for (let x = 5 + drop * 2; x < cols - 3; x += 11 + drop) {
      putSet(base, cols, rows, x, y, TARMAC_STREAK_LUM);
      putSet(base, cols, rows, x + 1, y, TARMAC_STREAK_LUM);
      putSet(base, cols, rows, x + 2, y, TARMAC_STREAK_LUM);
    }
  }

  // Two distant floodlight masts rising from the horizon — quiet verticals
  // that fill the empty bays above the fuselage with layered depth.
  const mastTop = Math.max(geo.glassTop + 2, Math.round(rows * 0.22));

  for (const mx of [Math.round(cols * 0.235), Math.round(cols * 0.52), Math.round(cols * 0.71)]) {
    for (let y = mastTop; y <= geo.horizonRow; y++) {
      putSet(base, cols, rows, mx, y, MAST_LUM);
    }

    for (let dx = -1; dx <= 1; dx++) {
      putSet(base, cols, rows, mx + dx, mastTop, MAST_HEAD_LUM);
      putSet(base, cols, rows, mx + dx, mastTop + 1, MAST_HEAD_LUM);
    }

    for (let y = mastTop - 3; y <= mastTop + 4; y++) {
      for (let x = mx - 4; x <= mx + 4; x++) {
        const d = Math.sqrt((x - mx) * (x - mx) + (y - mastTop - 0.5) * (y - mastTop - 0.5));

        if (d >= 1.5 && d < 4.5) {
          putMax(base, cols, rows, x, y, MAST_GLOW_LUM * (1 - d / 4.5));
        }
      }
    }
  }

  // Floodlight pool: an elliptical wash on the apron under the fuselage.
  const poolCy = Math.min(rows - 1, Math.round((bellyY + geo.floorRow) / 2 + 1));
  const poolRy = Math.max(2, geo.floorRow - poolCy + 1);

  for (let y = bellyY; y < geo.floorRow; y++) {
    for (let x = geo.poolCx - geo.poolRx; x <= geo.poolCx + geo.poolRx; x++) {
      const dx = (x - geo.poolCx) / geo.poolRx;
      const dy = (y - poolCy) / poolRy;
      const d2 = dx * dx + dy * dy;

      if (d2 < 1) {
        putMax(base, cols, rows, x, y, POOL_MAX_LUM * (1 - d2));
      }
    }
  }

  // Taxiway edge dots receding to the right, three depths.
  const taxi: ReadonlyArray<{ lum: number; rowUp: number; step: number; x0: number }> = [
    { lum: TAXI_NEAR_LUM, rowUp: 3, step: 8, x0: 0.6 },
    { lum: TAXI_MID_LUM, rowUp: 7, step: 11, x0: 0.68 },
    { lum: TAXI_FAR_LUM, rowUp: 10, step: 14, x0: 0.76 },
  ];

  for (const t of taxi) {
    const y = geo.floorRow - t.rowUp;

    for (let x = Math.round(cols * t.x0); x < cols - 1; x += t.step) {
      putMax(base, cols, rows, x, y, t.lum);
    }
  }

  // The airliner fuselage: rounded nose, crown line, upper tube, cheatline,
  // dark belly, upswept tail cone. The cockpit notch sits just behind the
  // nose tip so orientation is instant.
  for (let x = geo.noseX; x <= geo.tailX; x++) {
    const tube = tubeAt(geo, cols, x);

    if (!tube) {
      continue;
    }

    const [yTop, yBot] = tube;

    for (let y = yTop; y <= yBot; y++) {
      let v: number;

      if (y === yTop) {
        v = FUS_CROWN_LUM;
      } else if (y < geo.centerY && y < yBot) {
        v = FUS_UPPER_LUM;
      } else if (y === geo.centerY && y < yBot) {
        v = FUS_CHEAT_LUM;
      } else if (y === yBot) {
        v = FUS_KEEL_LUM;
      } else {
        v = FUS_BELLY_LUM;
      }

      // Cockpit windows: a dark 2-row notch behind the rounded nose tip.
      if (x >= geo.noseX + 3 && x <= geo.noseX + 7 && y > yTop && y <= yTop + 2 && y < geo.centerY) {
        v = COCKPIT_LUM;
      }

      putSet(base, cols, rows, x, y, v);
    }
  }

  // Portholes: a row of dark dots breaking the upper band.
  const portholeY = geo.centerY - 3;

  for (let x = geo.noseX + Math.max(8, Math.round(cols * 0.065)); x <= geo.leadRoot - 8; x += 3) {
    const tube = tubeAt(geo, cols, x);

    if (tube && portholeY > tube[0] && portholeY < geo.centerY) {
      putSet(base, cols, rows, x, portholeY, PORTHOLE_LUM);
    }
  }

  // Wing-root fairing blending the wing into the belly.
  for (let x = Math.round(cols * 0.47); x <= Math.round(cols * 0.585); x++) {
    for (let dy = -1; dy <= 1; dy++) {
      putSet(base, cols, rows, x, bellyY + dy, FAIRING_LUM);
    }
  }

  // The wing: a foreshortened plank sweeping down toward the viewer, top
  // surface catching the floods, thicker (nearer) at the tip.
  for (let x = geo.wingTipX; x <= geo.wingRootX; x++) {
    const u = (x - geo.wingTipX) / Math.max(1, geo.wingRootX - geo.wingTipX);
    const yC = wingYAt(geo, x);
    const thick = u < 0.4 ? 4 : u < 0.7 ? 3 : 2;

    putSet(base, cols, rows, x, yC, WING_EDGE_LUM);

    for (let dy = 1; dy < thick; dy++) {
      putSet(base, cols, rows, x, yC + dy, WING_FILL_LUM);
    }
  }

  // Wingtip cap: the near end reads as a deliberate terminus.
  for (let dy = 0; dy <= 2; dy++) {
    putSet(base, cols, rows, geo.wingTipX, geo.wingTipY + dy, WING_EDGE_LUM);
  }

  // Two engine nacelles slung under the wing: dense lozenges with dark
  // inlet mouths facing the nose — the strongest recognition anchors.
  const nacelles: ReadonlyArray<{ tall: number; x0: number; x1: number }> = [
    { tall: Math.max(3, Math.round(rows * 0.05)), x0: Math.round(cols * 0.305), x1: Math.round(cols * 0.305) + Math.max(7, Math.round(cols * 0.085)) },
    { tall: Math.max(2, Math.round(rows * 0.035)), x0: Math.round(cols * 0.46), x1: Math.round(cols * 0.46) + Math.max(5, Math.round(cols * 0.058)) },
  ];

  for (const n of nacelles) {
    const mid = Math.round((n.x0 + n.x1) / 2);
    const top = wingYAt(geo, mid) + 2;
    const bot = top + n.tall;

    // Pylon up to the wing underside.
    for (let x = n.x1 - 6; x <= n.x1 - 5; x++) {
      putSet(base, cols, rows, x, top - 1, PYLON_LUM);
    }

    for (let x = n.x0; x <= n.x1; x++) {
      for (let y = top; y <= bot; y++) {
        let v = y === top ? NACELLE_TOP_LUM : NACELLE_BODY_LUM;

        if (x === n.x0) {
          v = NACELLE_LIP_LUM; // inlet lip
        } else if (x <= n.x0 + 2) {
          v = NACELLE_INLET_LUM; // dark inlet mouth
        }

        putSet(base, cols, rows, x, y, v);
      }
    }
  }

  // Landing gear: nose and main legs down to the apron, bogies at the feet.
  const gearBottom = geo.floorRow - Math.max(2, Math.round(rows * 0.03));
  const gears: ReadonlyArray<{ from: number; x: number }> = [
    { from: bellyY + 1, x: Math.round(cols * 0.14) },
    { from: bellyY + 3, x: Math.round(cols * 0.545) },
  ];

  for (const g of gears) {
    for (let y = g.from; y <= gearBottom; y++) {
      putSet(base, cols, rows, g.x, y, GEAR_LUM);
      putSet(base, cols, rows, g.x + 1, y, GEAR_LUM);
    }

    for (let x = g.x - 1; x <= g.x + 2; x++) {
      putSet(base, cols, rows, x, gearBottom, BOGIE_LUM);
      putSet(base, cols, rows, x, gearBottom + 1, BOGIE_LUM);
    }
  }

  // The tail fin: ONE compact swept silhouette — leading edge raked aft,
  // trailing rudder line near-vertical, a rudder hinge seam inside. Solid
  // '=' fill with '+' edges so it survives bin-4 pooling.
  const finSpan = Math.max(1, geo.crownY - geo.finTop);

  for (let y = geo.finTop; y <= geo.crownY; y++) {
    const u = (y - geo.finTop) / finSpan; // 0 at the tip, 1 at the root
    const le = Math.round(geo.leadTip + (geo.leadRoot - geo.leadTip) * u);
    const te = Math.round(geo.trailTip + (geo.trailRoot - geo.trailTip) * u);

    for (let x = le; x <= te; x++) {
      putSet(base, cols, rows, x, y, x === le || x === te ? FIN_EDGE_LUM : FIN_FILL_LUM);
    }

    // Rudder hinge seam, sharpening the vertical trailing plane.
    if (y > geo.finTop + 1 && te - 3 > le + 1) {
      putSet(base, cols, rows, te - 3, y, FIN_RUDDER_LUM);
    }
  }

  // Jet bridge: a constant-thickness corridor sloping up from the terminal
  // to the forward door, accordion ribs along it, a denser cab at the
  // fuselage, and two support legs down to the apron.
  const doorX = geo.noseX + Math.max(6, Math.round(cols * 0.058));
  const bridgeX0 = Math.max(1, Math.round(cols * 0.01));
  const bridgeY1 = geo.centerY - 2; // roof at the door
  const bridgeY0 = Math.min(geo.floorRow - 4, bridgeY1 + Math.max(3, Math.round(rows * 0.11)));
  const bridgeH = Math.max(3, Math.round(rows * 0.045));

  for (let x = bridgeX0; x <= doorX; x++) {
    const u = (x - bridgeX0) / Math.max(1, doorX - bridgeX0);
    const yTop = Math.round(bridgeY0 + (bridgeY1 - bridgeY0) * u);

    putSet(base, cols, rows, x, yTop, BRIDGE_ROOF_LUM);

    for (let dy = 1; dy <= bridgeH; dy++) {
      putSet(base, cols, rows, x, yTop + dy, (x - bridgeX0) % 3 === 0 ? BRIDGE_RIB_LUM : BRIDGE_LUM);
    }
  }

  // Accordion cab hugging the fuselage at the door.
  for (let x = doorX - 2; x <= doorX + 1; x++) {
    for (let dy = -1; dy <= bridgeH + 1; dy++) {
      putSet(base, cols, rows, x, bridgeY1 + dy, x % 2 === 0 ? BRIDGE_CAB_LUM : BRIDGE_RIB_LUM);
    }
  }

  // Support legs at thirds of the run.
  for (const u of [0.35, 0.75]) {
    const lx = Math.round(bridgeX0 + (doorX - bridgeX0) * u);
    const yTop = Math.round(bridgeY0 + (bridgeY1 - bridgeY0) * u);

    for (let y = yTop + bridgeH + 1; y < geo.floorRow - 1; y++) {
      putSet(base, cols, rows, lx, y, GEAR_LUM);
      putSet(base, cols, rows, lx + 1, y, GEAR_LUM);
    }
  }

  // The curtain wall, in front of the night: fascia band across every
  // column, then paired mullions with head blocks and base plates, and
  // structural transoms over everything beyond the glass.
  for (let y = geo.fasciaTop; y < geo.glassTop; y++) {
    const edge = y <= geo.fasciaTop + 1 || y >= geo.glassTop - 2;
    const reveal = y === geo.fasciaTop + 2 && geo.glassTop - geo.fasciaTop >= 6;

    for (let x = 0; x < cols; x++) {
      putSet(base, cols, rows, x, y, reveal ? FASCIA_REVEAL_LUM : edge ? FASCIA_EDGE_LUM : FASCIA_FILL_LUM);
    }
  }

  for (let x = 0; x < cols; x++) {
    if (x % geo.mullionStep !== 0 && x !== cols - 2) {
      continue;
    }

    // Two-cell shaft the full glass height.
    for (let y = geo.glassTop; y < geo.floorRow; y++) {
      putSet(base, cols, rows, x, y, MULLION_LUM);
      putSet(base, cols, rows, x + 1, y, MULLION_LUM);
    }

    // Head block under the fascia and base plate at the sill — dense caps
    // so the wall's rhythm survives binarization.
    for (let dx = -1; dx <= 2; dx++) {
      putSet(base, cols, rows, x + dx, geo.glassTop, MULLION_CAP_LUM);
      putSet(base, cols, rows, x + dx, geo.glassTop + 1, MULLION_CAP_LUM);
      putSet(base, cols, rows, x + dx, geo.floorRow - 2, MULLION_CAP_LUM);
      putSet(base, cols, rows, x + dx, geo.floorRow - 1, MULLION_CAP_LUM);
    }

    // Mullion feet reflected onto the polished floor.
    for (let dy = 5; dy <= 9; dy++) {
      putMax(base, cols, rows, x, geo.floorRow + dy, MULLION_REFLECT_LUM - (dy - 5) * 0.012);
      putMax(base, cols, rows, x + 1, geo.floorRow + dy, MULLION_REFLECT_LUM - (dy - 5) * 0.012);
    }
  }

  for (const ty of [geo.transomA, geo.transomB]) {
    for (let x = 0; x < cols; x++) {
      putSet(base, cols, rows, x, ty, TRANSOM_LUM);
    }
  }

  // The sill band: a dense full-width stylobate grounding the wall —
  // bright top edge, '|'-grade body deep enough to survive bin-4 pooling,
  // and an under-shadow row.
  const sillDepth = Math.max(2, Math.round(rows * 0.04));

  for (let x = 0; x < cols; x++) {
    putSet(base, cols, rows, x, geo.floorRow, SILL_EDGE_LUM);

    for (let dy = 1; dy <= sillDepth; dy++) {
      putSet(base, cols, rows, x, geo.floorRow + dy, SILL_FILL_LUM);
    }

    putSet(base, cols, rows, x, geo.floorRow + sillDepth + 1, SILL_BASE_LUM);
  }

  // Gate seating, committed: two rows of chair silhouettes — back top
  // edge, back, cushion, legs — each anchored on a faint floor seam, with
  // the central walkway kept clear.
  const seatRows: ReadonlyArray<{
    back: number;
    cushion: number;
    leg: number;
    margin: number;
    seam: number;
    top: number;
    unit: number;
    y: number;
  }> = [
    {
      back: SEAT_BACK_A_LUM,
      cushion: SEAT_CUSHION_A_LUM,
      leg: SEAT_LEG_A_LUM,
      margin: 0.06,
      seam: SEAT_SEAM_A_LUM,
      top: SEAT_TOP_A_LUM,
      unit: 6,
      y: geo.seatRowA,
    },
    {
      back: SEAT_BACK_B_LUM,
      cushion: SEAT_CUSHION_B_LUM,
      leg: SEAT_LEG_B_LUM,
      margin: 0.02,
      seam: SEAT_SEAM_B_LUM,
      top: SEAT_TOP_B_LUM,
      unit: 7,
      y: geo.seatRowB,
    },
  ];

  for (const row of seatRows) {
    const margin = Math.round(cols * row.margin);
    const legRow = Math.min(rows - 1, row.y + 2);

    // The floor seam the whole row stands on (skips nothing — it is the
    // carpet track line, continuous under the walkway too).
    for (let x = margin; x < cols - margin; x++) {
      putMax(base, cols, rows, x, legRow, row.seam);
    }

    for (let x = margin; x < cols - margin; x++) {
      if (Math.abs(x - geo.cx) <= geo.aisleHalf) {
        continue; // the walkway gap
      }

      const phase = x % row.unit;

      if (phase >= row.unit - 2) {
        continue; // gap between seat units
      }

      putSet(base, cols, rows, x, row.y - 1, row.top);
      putSet(base, cols, rows, x, row.y, row.back);
      putSet(base, cols, rows, x, row.y + 1, row.cushion);

      // Legs at the unit edges, standing on the seam.
      if (phase === 0 || phase === row.unit - 3) {
        putMax(base, cols, rows, x, legRow, row.leg);
      }
    }
  }
}

export const scene: SceneModule = {
  dockGlyph: [
    "============",
    "|    ·   =+|",
    "|=========+|",
    "|  ==  ==  |",
    "============",
    " :: ::  :: :",
  ],
  id: "airport-gate",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    context.lights.splice(0, context.lights.length);
    buildBase(width, height);
  },
  summaryChip: "OTseek, 2026 — a ChatGPT app in the first public wave.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      beaconAmp: 0.15,
      beaconBase: 0.8,
      beaconPeriod: 6,
      beaconSideAmp: 0.12,
      beaconSideBase: 0.7,
      glowAmp: 0.18,
      glowRadius: 6,
      hazeAmount: 0.07,
      hazeFloor: 0.02,
      hazeScale: 0.055,
      hazeSpeed: 0.04,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      beaconAmp = 0.15,
      beaconBase = 0.8,
      beaconPeriod = 6,
      beaconSideAmp = 0.12,
      beaconSideBase = 0.7,
      glowAmp = 0.18,
      glowRadius = 6,
      hazeAmount = 0.07,
      hazeFloor = 0.02,
      hazeScale = 0.055,
      hazeSpeed = 0.04,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);

    // 1) Air: haze breathes only inside the glass (night air over the
    // apron), sampled on a coarse lattice and bilinearly upsampled.
    const stride = 4;
    const gw = Math.floor(w / stride) + 2;
    const gh = Math.floor(h / stride) + 2;

    if (hazeLattice.length !== gw * gh) {
      hazeLattice = new Float32Array(gw * gh);
    }

    for (let gy = 0; gy < gh; gy++) {
      const ny = gy * stride * hazeScale * 1.4 + time * hazeSpeed * 0.6;

      for (let gx = 0; gx < gw; gx++) {
        hazeLattice[gy * gw + gx] = fbm2(hazeNoise, gx * stride * hazeScale + time * hazeSpeed, ny, 2);
      }
    }

    for (let y = 0; y < h; y++) {
      const gy = y / stride;
      const gy0 = Math.floor(gy);
      const fy = gy - gy0;
      const rowA = gy0 * gw;
      const rowB = (gy0 + 1) * gw;
      const inGlass = y > geo.glassTop + 1 && y < geo.floorRow;

      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const b = base[i] ?? 0;

        if (!inGlass) {
          data[i] = b;
          continue;
        }

        const gx = x / stride;
        const gx0 = Math.floor(gx);
        const fx = gx - gx0;
        const top = (hazeLattice[rowA + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowA + gx0 + 1] ?? 0) * fx;
        const bottom = (hazeLattice[rowB + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowB + gx0 + 1] ?? 0) * fx;
        const air = clamp01(hazeFloor + hazeAmount * (top * (1 - fy) + bottom * fy));
        data[i] = air > b ? air : b;
      }
    }

    // 2) The one motion: the fin-tip anti-collision beacon. A slow sine
    // pulse lifts a tiny cluster toward '@' at peak and breathes a faint
    // glow onto the fin tip. Pure f(time) — no flicker.
    const pulse = 0.5 + 0.5 * Math.sin((Math.PI * 2 * time) / Math.max(0.5, beaconPeriod));
    const by = geo.finTop - 1;
    const coreLum = beaconBase + beaconAmp * pulse;
    const sideLum = beaconSideBase + beaconSideAmp * pulse;

    for (let dy = -1; dy <= 0; dy++) {
      putSet(data, w, h, geo.beaconX, by + dy, coreLum);
      putSet(data, w, h, geo.beaconX - 1, by + dy, sideLum);
      putSet(data, w, h, geo.beaconX + 1, by + dy, sideLum);
    }

    const r = Math.max(1, glowRadius);

    for (let y = by - r; y <= by + r; y++) {
      if (y < 0 || y >= h) {
        continue;
      }

      for (let x = geo.beaconX - r; x <= geo.beaconX + r; x++) {
        if (x < 0 || x >= w) {
          continue;
        }

        const dist = Math.sqrt((x - geo.beaconX) * (x - geo.beaconX) + (y - by) * (y - by));

        if (dist >= r || dist < 1.5) {
          continue; // the core cells stay as written
        }

        const f = 1 - dist / r;
        const i = y * w + x;
        data[i] = clamp01((data[i] ?? 0) + glowAmp * pulse * f * f);
      }
    }
  },
};
