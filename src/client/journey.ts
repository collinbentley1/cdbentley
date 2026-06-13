/**
 * The Journey scroll engine (§4 of the design brief).
 * - sprite walks the trail bound to scroll progress, 10fps stepped frames
 * - companions join at their stations and follow with a stagger
 * - cairns gain a stone (150ms drop + dust) as the walker passes
 * - card reveals: IntersectionObserver + rAF force-reveal fallback (A1 fix)
 * - stat bars count up; time-of-day tint; keyboard walking; Konami conga
 * - prefers-reduced-motion: cross-fade between stations, instant reveals
 */

import { reducedMotion } from "./shared.ts";

type CompanionName = "horse" | "bulldog" | "robot" | "crane" | "pigeon" | "pear";

type SpriteMeta = {
  frameWidth: number;
  frameHeight: number;
  walkFrames: number;
  idleFrames: number;
  scale: number;
  walkSrc: string;
  idleSrc: string;
};

const SPRITES = "/assets/sprites";

const TRAINER = {
  frameHeight: 128,
  frameWidth: 128,
  idleSrc: `${SPRITES}/trainer-idle.png`,
  scale: 0.85,
  sheetSrc: `${SPRITES}/trainer-sheet.png`,
  waveSrc: `${SPRITES}/trainer-wave.png`,
};

// Companion scale dropped 2.6 -> 1.85 and horse 0.62 -> 0.82 to close the
// pixel-density gap with the painted 128px trainer (visual-critique finding).
const COMPANIONS: Record<CompanionName, SpriteMeta> = {
  bulldog: meta(27, 18, 1.85, "bulldog"),
  crane: meta(24, 20, 1.85, "crane"),
  horse: { frameHeight: 128, frameWidth: 128, idleFrames: 2, idleSrc: `${SPRITES}/horse-idle.png`, scale: 0.82, walkFrames: 4, walkSrc: `${SPRITES}/horse-walk.png` },
  pear: meta(19, 19, 1.85, "pear"),
  pigeon: meta(23, 18, 1.85, "pigeon"),
  robot: meta(21, 20, 1.85, "robot"),
};

function meta(frameWidth: number, frameHeight: number, scale: number, name: string): SpriteMeta {
  return { frameHeight, frameWidth, idleFrames: 2, idleSrc: `${SPRITES}/${name}-idle.png`, scale, walkFrames: 4, walkSrc: `${SPRITES}/${name}-walk.png` };
}

/**
 * Trail scenery: themed props per gap between stations (10x visual pass).
 * `at` is the fraction along the gap; `side` is lateral px from the trail;
 * horizon strips sit far behind with a slow parallax factor.
 */
type SceneryProp = {
  src: string;
  width: number;
  height: number;
  scale: number;
  at: number;
  side: number;
  horizon?: boolean;
  /** Px lifted above the trail point (hanging lanterns, raised horizons). */
  lift?: number;
};

const prop = (src: string, width: number, height: number, scale: number, at: number, side: number, opts: { horizon?: boolean; lift?: number } = {}): SceneryProp => {
  const base: SceneryProp = { at, height, scale, side, src, width };
  if (opts.horizon) {
    base.horizon = true;
  }
  if (opts.lift) {
    base.lift = opts.lift;
  }
  return base;
};

const GAP_SCENERY: SceneryProp[][] = [
  // trailhead → stables: paddock fence + ground cover, both sides
  [prop("fence", 36, 18, 2, 0.42, -120), prop("flowers", 15, 6, 2, 0.58, 96), prop("bush", 20, 12, 2, 0.8, 130), prop("rock", 15, 8, 2, 0.7, -88)],
  // stables → yale: pines bracketing the path for depth
  [prop("pine", 22, 36, 2, 0.3, 124), prop("pine-small", 16, 26, 1.6, 0.46, -150), prop("bush", 20, 12, 2, 0.72, 96), prop("rock", 15, 8, 2, 0.84, -92)],
  // yale → robot room: collegiate arch (cleared right) + aspen on the left
  [prop("arch", 20, 22, 3, 0.34, 150), prop("aspen", 22, 32, 2, 0.6, -120), prop("flowers", 15, 6, 2, 0.8, 86)],
  // robot room → yale med: the lab bench leavings
  [prop("beaker", 12, 11, 2, 0.3, 95), prop("pine-small", 16, 26, 2, 0.64, -120), prop("bush", 20, 12, 2, 0.82, 100)],
  // yale med → beijing: paper lanterns hung over the trail
  [prop("lantern", 14, 14, 2.2, 0.28, -70, { lift: 150 }), prop("lantern", 14, 14, 2.4, 0.5, 70, { lift: 196 }), prop("lantern", 14, 14, 2.2, 0.72, -60, { lift: 140 }), prop("aspen", 22, 32, 2, 0.6, 140)],
  // beijing → humana: the city rises on both sides
  [prop("skyline", 110, 30, 3, 0.5, 0, { horizon: true }), prop("skyline", 110, 30, 1.7, 0.5, -150, { horizon: true }), prop("lantern", 14, 14, 2, 0.74, 96, { lift: 110 })],
  // humana → healthyr: deeper into the city, lit windows both sides
  [prop("skyline", 110, 30, 3, 0.5, 0, { horizon: true }), prop("skyline", 110, 30, 2, 0.5, 150, { horizon: true }), prop("cattails", 16, 10, 2, 0.8, -104)],
  // healthyr → otseek: the long view opens, peaks raised into frame
  [prop("ridge", 128, 34, 3, 0.5, 0, { horizon: true, lift: 90 }), prop("pine", 22, 36, 2, 0.74, -125), prop("flowers", 15, 6, 2, 0.84, 92)],
  // otseek → now: dusk in the mountains
  [prop("ridge", 128, 34, 3, 0.46, 0, { horizon: true, lift: 110 }), prop("aspen", 22, 32, 2, 0.66, 118), prop("rock", 15, 8, 2, 0.82, -90), prop("cattails", 16, 10, 2, 0.8, 150)],
];

const journey = document.getElementById("journey");
const trailLayer = document.getElementById("trail-layer");
const trailSvg = document.getElementById("trail-svg");
const trailPath = document.getElementById("trail-path");
const trailShadow = document.getElementById("trail-path-shadow");
const walkerRoot = document.getElementById("walker");
const sky = document.getElementById("sky");
const starsRoot = document.getElementById("stars");
const heroAnchor = document.querySelector(".trailhead-stage .hero-sprite");
const helloBubble = document.getElementById("hello-bubble");

if (
  journey instanceof HTMLElement &&
  trailLayer instanceof HTMLElement &&
  trailSvg instanceof SVGSVGElement &&
  trailPath instanceof SVGPathElement &&
  trailShadow instanceof SVGPathElement &&
  walkerRoot instanceof HTMLElement &&
  heroAnchor instanceof HTMLElement
) {
  initJourney({ heroAnchor, journey, trailLayer, trailPath, trailShadow, trailSvg, walkerRoot });
}

type Ctx = {
  journey: HTMLElement;
  trailLayer: HTMLElement;
  trailSvg: SVGSVGElement;
  trailPath: SVGPathElement;
  trailShadow: SVGPathElement;
  walkerRoot: HTMLElement;
  heroAnchor: HTMLElement;
};

type Station = {
  element: HTMLElement;
  cairn: HTMLElement | null;
  dust: HTMLElement | null;
  companion: CompanionName | null;
  point: { x: number; y: number };
  distance: number;
  scrollAnchor: number;
  dropped: boolean;
};

type Follower = {
  name: CompanionName;
  element: HTMLDivElement;
  meta: SpriteMeta;
  stationIndex: number;
  joined: boolean;
  distance: number;
  frame: number;
  lastStep: number;
  facing: 1 | -1;
};

function initJourney(ctx: Ctx): void {
  const sceneElements = [...ctx.journey.querySelectorAll<HTMLElement>(".scene-station")];
  const stations: Station[] = sceneElements.map((element) => ({
    cairn: element.querySelector<HTMLElement>(".cairn"),
    companion: (element.dataset.companion as CompanionName | undefined) ?? null,
    distance: 0,
    dropped: false,
    dust: element.querySelector<HTMLElement>("[data-dust]"),
    element,
    point: { x: 0, y: 0 },
    scrollAnchor: 0,
  }));

  // --- walker sprites ------------------------------------------------------
  const trainerEl = document.createElement("div");
  trainerEl.className = "walker-sprite walker-trainer";
  ctx.walkerRoot.append(trainerEl);

  const followers: Follower[] = [];
  for (const [index, station] of stations.entries()) {
    if (!station.companion) {
      continue;
    }
    const spriteMeta = COMPANIONS[station.companion];
    const element = document.createElement("div");
    element.className = "walker-sprite walker-companion";
    ctx.walkerRoot.append(element);
    followers.push({ distance: 0, element, facing: 1, frame: 0, joined: false, lastStep: 0, meta: spriteMeta, name: station.companion, stationIndex: index });
  }

  preloadSheets(followers);

  // --- scenery ---------------------------------------------------------------
  type PlacedProp = { element: HTMLDivElement; config: SceneryProp; gapIndex: number; baseX: number; baseY: number };
  const sceneryRoot = document.createElement("div");
  sceneryRoot.className = "scenery";
  ctx.trailLayer.prepend(sceneryRoot);
  const placedProps: PlacedProp[] = [];
  GAP_SCENERY.forEach((gap, gapIndex) => {
    for (const config of gap) {
      const element = document.createElement("div");
      element.className = config.horizon ? "scenery-prop scenery-horizon" : "scenery-prop";
      element.style.width = `${config.width * config.scale}px`;
      element.style.height = `${config.height * config.scale}px`;
      element.style.backgroundImage = `url(${SPRITES}/${config.src}.png)`;
      sceneryRoot.append(element);
      placedProps.push({ baseX: 0, baseY: 0, config, element, gapIndex });
    }
  });

  function placeScenery(): void {
    const width = ctx.journey.clientWidth;
    const mobile = width < 760;
    for (const placed of placedProps) {
      const fromDistance = placed.gapIndex === 0 ? 0 : (stations[placed.gapIndex - 1]?.distance ?? 0);
      const toDistance = stations[placed.gapIndex]?.distance ?? totalLength;
      const along = fromDistance + (toDistance - fromDistance) * placed.config.at;
      const point = pointAt(along);
      const w = placed.config.width * placed.config.scale;
      const h = placed.config.height * placed.config.scale;
      const side = mobile ? Math.sign(placed.config.side) * Math.min(Math.abs(placed.config.side), 70) : placed.config.side;
      let x = placed.config.horizon && side === 0 ? width / 2 - w / 2 : point.x + side - w / 2;
      x = clamp(x, 4, Math.max(4, width - w - 4));
      const y = point.y - h - (placed.config.lift ?? 0);
      placed.baseX = Math.round(x);
      placed.baseY = Math.round(y);
      placed.element.style.transform = `translate3d(${placed.baseX}px, ${placed.baseY}px, 0)`;
    }
  }

  // --- verge cover: dense grass tufts + pebbles hugging the trail edges -------
  const vergeRoot = document.getElementById("verge");
  const vergePieces: HTMLDivElement[] = [];

  function placeVerge(): void {
    if (!(vergeRoot instanceof HTMLElement) || totalLength <= 0) {
      return;
    }
    vergeRoot.replaceChildren();
    vergePieces.length = 0;
    const width = ctx.journey.clientWidth;
    const step = 34;
    let index = 0;
    for (let along = 24; along < totalLength - 24; along += step) {
      const seed = Math.floor(along);
      // Two tufts per step, one each side, with jitter; an occasional pebble.
      for (const dir of [-1, 1] as const) {
        if (rand(seed * 3 + dir) > 0.82) {
          continue;
        }
        const point = pointAt(along + (rand(seed + dir) - 0.5) * step);
        const offset = 16 + rand(seed * 7 + dir) * 26;
        const tangent = pointAt(along + 6);
        const back = pointAt(along - 6);
        const len = Math.hypot(tangent.x - back.x, tangent.y - back.y) || 1;
        const nx = (-(tangent.y - back.y) / len) * dir;
        const ny = ((tangent.x - back.x) / len) * dir;
        const pebble = rand(seed * 11 + dir) > 0.8;
        const variant = Math.floor(rand(seed * 5 + dir) * (pebble ? 2 : 3));
        const scale = 2;
        const sw = (pebble ? 4 : 11) * scale;
        const sh = (pebble ? 4 : 3) * scale;
        const x = point.x + nx * offset - sw / 2;
        const y = point.y + ny * offset - sh;
        if (x < 2 || x > width - sw - 2) {
          continue;
        }
        const piece = document.createElement("div");
        piece.className = "verge-piece";
        piece.style.width = `${sw}px`;
        piece.style.height = `${sh}px`;
        piece.style.backgroundImage = `url(${SPRITES}/${pebble ? `pebble-${variant}` : `grass-tuft-${variant}`}.png)`;
        piece.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        vergeRoot.append(piece);
        vergePieces.push(piece);
        index += 1;
      }
    }
    void index;
  }

  /** Horizon strips drift slower than the page — cheap pixel parallax. */
  function parallaxScenery(): void {
    for (const placed of placedProps) {
      if (!placed.config.horizon) {
        continue;
      }
      const drift = Math.round(window.scrollY * 0.07);
      placed.element.style.transform = `translate3d(${placed.baseX}px, ${placed.baseY + drift}px, 0)`;
    }
  }

  // --- sun + moon arc ----------------------------------------------------------
  const sunEl = document.getElementById("sun");
  const moonEl = document.getElementById("moon");

  function celestial(): void {
    if (!(sunEl instanceof HTMLElement) || !(moonEl instanceof HTMLElement)) {
      return;
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    const x = window.innerWidth * (0.06 + 0.86 * p);
    const y = 30 + (1 - Math.sin(p * Math.PI)) * 110;
    const sunFade = clamp((0.72 - p) / 0.1, 0, 1);
    sunEl.style.opacity = String(sunFade);
    sunEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    const moonFade = clamp((p - 0.7) / 0.1, 0, 1);
    moonEl.style.opacity = String(moonFade);
    moonEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y - 6)}px, 0)`;
  }

  // --- campfire (endcap payoff) ---------------------------------------------------
  const campfire = document.getElementById("campfire");
  if (campfire instanceof HTMLElement && !reducedMotion.matches) {
    let fireFrame = 0;
    const fireObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!campfire.dataset.lit) {
            campfire.dataset.lit = "1";
            window.setInterval(() => {
              fireFrame = (fireFrame + 1) % 4;
              campfire.style.backgroundPosition = `${(fireFrame * 100) / 3}% 0`;
            }, 170);
          }
          fireObserver.disconnect();
        }
      }
    });
    fireObserver.observe(campfire);
  }

  // --- path ----------------------------------------------------------------
  let totalLength = 0;
  let anchors: Array<{ scroll: number; distance: number }> = [];
  let layoutSignature = "";

  function layout(): void {
    // Re-laying the path is expensive; skip when nothing moved.
    const signature = `${ctx.journey.clientWidth}x${ctx.journey.scrollHeight}x${window.innerHeight}`;
    if (signature === layoutSignature) {
      return;
    }
    layoutSignature = signature;
    const journeyRect = ctx.journey.getBoundingClientRect();
    const journeyTop = journeyRect.top + window.scrollY;
    const width = ctx.journey.clientWidth;
    const mobile = width < 760;

    const heroRect = ctx.heroAnchor.getBoundingClientRect();
    const start = { x: heroRect.left + heroRect.width / 2 - journeyRect.left, y: heroRect.top + heroRect.height + window.scrollY - journeyTop };

    const points: Array<{ x: number; y: number }> = [start];
    const stationPointIndexes: number[] = [];

    for (const station of stations) {
      const cairn = station.cairn ?? station.element;
      const rect = cairn.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - journeyRect.left;
      const y = rect.top + rect.height + window.scrollY - journeyTop - 4;

      const previous = points[points.length - 1];
      if (previous) {
        const midY = (previous.y + y) / 2;
        const swing = mobile ? 26 : Math.min(0.18 * width, 210);
        const direction = stationPointIndexes.length % 2 === 0 ? 1 : -1;
        points.push({ x: (previous.x + x) / 2 + swing * direction, y: midY });
      }

      points.push({ x, y });
      stationPointIndexes.push(points.length - 1);
      station.point = { x, y };
    }

    const endAnchor = document.getElementById("campfire") ?? document.getElementById("endcap");
    if (endAnchor) {
      const rect = endAnchor.getBoundingClientRect();
      // Land beside the fire, not on it.
      points.push({ x: rect.left + rect.width / 2 - journeyRect.left - 64, y: rect.top + rect.height + window.scrollY - journeyTop - 2 });
    }

    const d = catmullRom(points);
    ctx.trailPath.setAttribute("d", d);
    ctx.trailShadow.setAttribute("d", d);
    // The worn dirt bed (wide soft strokes under the dashed ink) grounds the trail.
    for (const id of ["trail-bed-edge", "trail-bed", "trail-bed-light"]) {
      document.getElementById(id)?.setAttribute("d", d);
    }
    const height = ctx.journey.scrollHeight;
    ctx.trailSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    ctx.trailSvg.setAttribute("width", String(width));
    ctx.trailSvg.setAttribute("height", String(height));

    totalLength = ctx.trailPath.getTotalLength();

    // Distance of each station along the path, by nearest-point sampling.
    for (const [index, station] of stations.entries()) {
      station.distance = distanceAtPoint(ctx.trailPath, totalLength, station.point, stationPointIndexes[index] ?? 0, points.length);
      station.scrollAnchor = station.point.y + journeyTop - window.innerHeight * 0.52;
    }

    anchors = [
      { distance: 0, scroll: start.y + journeyTop - window.innerHeight * 0.62 },
      ...stations.map((station) => ({ distance: station.distance, scroll: station.scrollAnchor })),
      { distance: totalLength, scroll: document.documentElement.scrollHeight - window.innerHeight },
    ].sort((a, b) => a.scroll - b.scroll);

    placeScenery();
    placeVerge();
  }

  // --- scroll → distance mapping --------------------------------------------
  function targetDistance(): number {
    const y = window.scrollY;
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    if (!first || !last) {
      return 0;
    }
    if (y <= first.scroll) {
      return first.distance;
    }
    if (y >= last.scroll) {
      return last.distance;
    }
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const a = anchors[index];
      const b = anchors[index + 1];
      if (a && b && y >= a.scroll && y <= b.scroll) {
        const t = (y - a.scroll) / (b.scroll - a.scroll || 1);
        return a.distance + (b.distance - a.distance) * t;
      }
    }
    return last.distance;
  }

  // --- walker state ----------------------------------------------------------
  let current = 0;
  let highWater = 0;
  let trainerFrame = 0;
  let trainerLastStep = 0;
  let lastMoveAt = performance.now();
  let waveUntil = performance.now() + 2800;
  let lastNearestStation = -1;
  let lastHousekeeping = 0;
  let lastSkyColor = "";

  /** Sprites animate via background-position (stepped frames); never layout. */
  function setSprite(element: HTMLElement, src: string, frames: number, frame: number, frameWidth: number, frameHeight: number, scale: number, row = 0, rows = 1, flip = false): void {
    const w = Math.round(frameWidth * scale);
    const h = Math.round(frameHeight * scale);
    element.style.width = `${w}px`;
    element.style.height = `${h}px`;
    element.style.backgroundImage = `url(${src})`;
    element.style.backgroundSize = `${w * frames}px ${h * rows}px`;
    element.style.backgroundPosition = `${-frame * w}px ${-row * h}px`;
    element.dataset.flip = flip ? "1" : "";
  }

  /** Position via transform only (§4: transform/opacity, no layout animation). */
  function placeAt(element: HTMLElement, point: { x: number; y: number }): void {
    const flip = element.dataset.flip ? " scaleX(-1)" : "";
    element.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0) translate(-50%, -100%)${flip}`;
  }

  function pointAt(distance: number): { x: number; y: number } {
    const point = ctx.trailPath.getPointAtLength(clamp(distance, 0, totalLength));
    return { x: point.x, y: point.y };
  }

  function frameLoop(now: number): void {
    const target = targetDistance();
    const delta = target - current;
    if (Math.abs(delta) < 0.6) {
      current = target;
    } else {
      current += delta * 0.16;
    }
    const moving = Math.abs(delta) > 1.4;
    if (moving) {
      lastMoveAt = now;
    }
    const idle = now - lastMoveAt > 2000;

    if (current > highWater) {
      highWater = current;
      for (const station of stations) {
        if (!station.dropped && highWater > station.distance + 8) {
          station.dropped = true;
          dropStone(station);
        }
      }
    }

    // Trainer ------------------------------------------------------------
    const ahead = pointAt(current + 7);
    const behind = pointAt(current - 7);
    const dx = ahead.x - behind.x;
    const dy = ahead.y - behind.y;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 0.85;
    const waving = now < waveUntil && current < 4;

    if (moving && now - trainerLastStep >= 100) {
      trainerFrame = (trainerFrame + 1) % 4;
      trainerLastStep = now;
      footstep(trainerFrame);
    }

    if (waving) {
      const waveFrame = Math.floor(now / 320) % 2;
      setSprite(trainerEl, TRAINER.waveSrc, 2, waveFrame, 128, 128, TRAINER.scale);
    } else if (idle || !moving) {
      const idleFrame = [0, 1, 0, 2][Math.floor(now / 420) % 4] ?? 0;
      setSprite(trainerEl, TRAINER.idleSrc, 4, idleFrame, 128, 128, TRAINER.scale);
    } else {
      const row = horizontal ? (dx >= 0 ? 3 : 2) : dy >= 0 ? 0 : 1;
      setSprite(trainerEl, TRAINER.sheetSrc, 4, trainerFrame, 128, 128, TRAINER.scale, row, 4);
    }
    placeAt(trainerEl, pointAt(current));

    // Companions -----------------------------------------------------------
    let joinedCount = 0;
    for (const follower of followers) {
      const station = stations[follower.stationIndex];
      if (!station) {
        continue;
      }
      if (!follower.joined && highWater >= station.distance - 2) {
        follower.joined = true;
        follower.distance = station.distance;
      }

      if (!follower.joined) {
        const waitFrame = Math.floor(now / 520) % follower.meta.idleFrames;
        setSprite(follower.element, follower.meta.idleSrc, follower.meta.idleFrames, waitFrame, follower.meta.frameWidth, follower.meta.frameHeight, follower.meta.scale, 0, 1, true);
        placeAt(follower.element, pointAt(station.distance - 58));
        continue;
      }

      joinedCount += 1;
      const followTarget = clamp(current - 115 * joinedCount, 0, totalLength);
      const followDelta = followTarget - follower.distance;
      follower.distance += Math.abs(followDelta) < 0.6 ? followDelta : followDelta * 0.11;
      const followMoving = Math.abs(followDelta) > 1.4;

      const fAhead = pointAt(follower.distance + 6);
      const fBehind = pointAt(follower.distance - 6);
      follower.facing = fAhead.x - fBehind.x >= 0 ? 1 : -1;

      if (followMoving && now - follower.lastStep >= 100) {
        follower.frame = (follower.frame + 1) % follower.meta.walkFrames;
        follower.lastStep = now;
      }

      if (followMoving) {
        setSprite(follower.element, follower.meta.walkSrc, follower.meta.walkFrames, follower.frame, follower.meta.frameWidth, follower.meta.frameHeight, follower.meta.scale, 0, 1, follower.facing < 0);
      } else {
        const idleFrame = Math.floor(now / 520 + joinedCount) % follower.meta.idleFrames;
        setSprite(follower.element, follower.meta.idleSrc, follower.meta.idleFrames, idleFrame, follower.meta.frameWidth, follower.meta.frameHeight, follower.meta.scale, 0, 1, follower.facing < 0);
      }
      // Loose parade: nudge alternating members off the path's normal so a
      // vertical trail doesn't stack everyone on one column.
      const tangentLength = Math.hypot(fAhead.x - fBehind.x, fAhead.y - fBehind.y) || 1;
      const normalX = -((fAhead.y - fBehind.y) / tangentLength);
      const normalY = (fAhead.x - fBehind.x) / tangentLength;
      const side = joinedCount % 2 === 0 ? 12 : -12;
      const followPoint = pointAt(follower.distance);
      placeAt(follower.element, { x: followPoint.x + normalX * side, y: followPoint.y + normalY * side });
    }

    parallaxScenery();
    celestial();
    if (now - lastHousekeeping > 180) {
      lastHousekeeping = now;
      tintSky();
      forceReveal();
    }
    requestAnimationFrame(frameLoop);
  }

  // --- reduced-motion path ----------------------------------------------------
  function reducedLoop(): void {
    const nearest = nearestStationIndex();
    if (nearest !== lastNearestStation) {
      lastNearestStation = nearest;
      crossFadeTo(nearest);
    }
    tintSky();
    parallaxScenery();
    celestial();
  }

  function nearestStationIndex(): number {
    const middle = window.scrollY + window.innerHeight * 0.5;
    const journeyTop = ctx.journey.getBoundingClientRect().top + window.scrollY;
    let best = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const [index, station] of stations.entries()) {
      const delta = Math.abs(station.point.y + journeyTop - middle);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    }
    return best;
  }

  function crossFadeTo(index: number): void {
    const station = stations[index];
    const baseDistance = station ? station.distance : 0;
    ctx.walkerRoot.style.transition = "opacity 150ms";
    ctx.walkerRoot.style.opacity = "0";
    window.setTimeout(() => {
      setSprite(trainerEl, TRAINER.idleSrc, 4, 0, 128, 128, TRAINER.scale);
      placeAt(trainerEl, pointAt(baseDistance));
      let shown = 0;
      for (const follower of followers) {
        const joined = index >= follower.stationIndex;
        follower.element.style.display = joined ? "" : "none";
        if (joined) {
          shown += 1;
          setSprite(follower.element, follower.meta.idleSrc, follower.meta.idleFrames, 0, follower.meta.frameWidth, follower.meta.frameHeight, follower.meta.scale);
          placeAt(follower.element, pointAt(Math.max(0, baseDistance - 100 * shown)));
        }
      }
      for (const [stationIndex, candidate] of stations.entries()) {
        if (stationIndex <= index && !candidate.dropped) {
          candidate.dropped = true;
          finishCairn(candidate);
        }
      }
      ctx.walkerRoot.style.opacity = "1";
    }, 160);
  }

  // --- cairns ------------------------------------------------------------------
  function dropStone(station: Station): void {
    const cairn = station.cairn;
    if (!cairn) {
      return;
    }
    const width = cairn.clientWidth || 56;
    const height = cairn.clientHeight || 60;
    const stepMs = 50;
    cairn.style.backgroundImage = `url(${SPRITES}/cairn-drop-3.png)`;
    cairn.style.backgroundSize = `${width * 3}px ${height}px`;
    for (const frame of [0, 1, 2]) {
      window.setTimeout(() => {
        cairn.style.backgroundPosition = `${-frame * width}px 0`;
      }, frame * stepMs);
    }
    window.setTimeout(() => {
      finishCairn(station);
      puffDust(station);
    }, 3 * stepMs);
  }

  function finishCairn(station: Station): void {
    const cairn = station.cairn;
    if (!cairn) {
      return;
    }
    cairn.style.backgroundImage = `url(${SPRITES}/cairn-4.png)`;
    cairn.style.backgroundSize = "100% 100%";
    cairn.style.backgroundPosition = "0 0";
  }

  function puffDust(station: Station): void {
    const dust = station.dust;
    if (!dust) {
      return;
    }
    dust.style.opacity = "1";
    [0, 1, 2].forEach((frame) => {
      window.setTimeout(() => {
        dust.style.backgroundPosition = `${-frame * 32}px 0`;
      }, frame * 60);
    });
    window.setTimeout(() => {
      dust.style.opacity = "0";
    }, 220);
  }

  // --- reveals -------------------------------------------------------------------
  const revealables = [...ctx.journey.querySelectorAll<HTMLElement>(".reveal")];
  const pending = new Set(revealables);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          reveal(entry.target);
        }
      }
    },
    { threshold: 0.25 },
  );
  for (const element of revealables) {
    observer.observe(element);
  }

  function reveal(element: HTMLElement): void {
    if (!pending.has(element)) {
      return;
    }
    pending.delete(element);
    element.classList.add("revealed");
    observer.unobserve(element);
  }

  /**
   * Belt-and-suspenders fallback (A1): force-reveal anything within 40% of the
   * viewport center — or anything already scrolled past, so jump-scrolls that
   * leap over a card (where IntersectionObserver never fires) can't ghost it.
   */
  function forceReveal(): void {
    if (pending.size === 0) {
      return;
    }
    const center = window.innerHeight / 2;
    const limit = window.innerHeight * 0.4;
    for (const element of [...pending]) {
      const rect = element.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const withinOrPassed = elementCenter - center < limit;
      const tallAndVisible = rect.top < window.innerHeight && rect.bottom > 0 && rect.height > window.innerHeight * 0.6;
      if (withinOrPassed || tallAndVisible) {
        reveal(element);
      }
    }
  }

  // --- stat bars --------------------------------------------------------------------
  const statChips = [...ctx.journey.querySelectorAll<HTMLElement>(".chip-stat")];
  for (const chip of statChips) {
    const segments = [...chip.querySelectorAll<HTMLElement>(".seg")];
    for (const segment of segments) {
      segment.classList.remove("seg-on");
    }
  }
  const barObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) {
          continue;
        }
        barObserver.unobserve(entry.target);
        const level = Number(entry.target.dataset.level ?? 0);
        const segments = [...entry.target.querySelectorAll<HTMLElement>(".seg")];
        segments.slice(0, level).forEach((segment, index) => {
          window.setTimeout(
            () => {
              segment.classList.add("seg-on");
            },
            reducedMotion.matches ? 0 : 110 * (index + 1),
          );
        });
      }
    },
    { threshold: 0.6 },
  );
  for (const chip of statChips) {
    barObserver.observe(chip);
  }

  // --- sky tint + stars -----------------------------------------------------------------
  // Wider arc so the dawn→day→golden→dusk progression actually reads (critique).
  const skyStops: Array<[number, [number, number, number]]> = [
    [0, [0xf9, 0xee, 0xd6]],
    [0.28, [0xf2, 0xe9, 0xcf]],
    [0.55, [0xed, 0xe6, 0xcc]],
    [0.78, [0xe7, 0xd6, 0xc2]],
    [1, [0xdc, 0xc4, 0xba]],
  ];

  function tintSky(): void {
    if (!(sky instanceof HTMLElement)) {
      return;
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    const color = lerpStops(skyStops, progress);
    if (color !== lastSkyColor) {
      lastSkyColor = color;
      sky.style.backgroundColor = color;
      if (starsRoot instanceof HTMLElement) {
        starsRoot.style.opacity = String(clamp((progress - 0.62) / 0.28, 0, 1) * 0.9);
      }
    }
  }

  if (starsRoot instanceof HTMLElement) {
    for (let index = 0; index < 26; index += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.backgroundImage = `url(${SPRITES}/star-${index % 3}.png)`;
      star.style.left = `${(index * 37 + 11) % 100}%`;
      star.style.top = `${(index * 23 + 7) % 55}%`;
      star.style.opacity = String(0.5 + ((index * 13) % 5) / 10);
      starsRoot.append(star);
    }
  }

  // --- intro bubble -----------------------------------------------------------------------
  if (helloBubble instanceof HTMLElement) {
    window.setTimeout(() => helloBubble.classList.add("show"), 500);
    window.setTimeout(() => {
      helloBubble.style.transition = "opacity 400ms";
      helloBubble.style.opacity = "0";
    }, 6000);
  }

  // --- keyboard walking ----------------------------------------------------------------------
  const sceneAnchors: HTMLElement[] = [document.querySelector<HTMLElement>(".trailhead") ?? ctx.journey, ...sceneElements, document.getElementById("endcap") ?? ctx.journey];

  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) {
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const middle = window.scrollY + window.innerHeight * 0.45;
    let index = 0;
    for (const [candidateIndex, anchor] of sceneAnchors.entries()) {
      if (anchor.getBoundingClientRect().top + window.scrollY <= middle + 8) {
        index = candidateIndex;
      }
    }
    const next = clamp(index + (event.key === "ArrowDown" ? 1 : -1), 0, sceneAnchors.length - 1);
    const target = sceneAnchors[next];
    if (target) {
      target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
      const card = target.querySelector<HTMLElement>(".card");
      if (card) {
        card.setAttribute("tabindex", "-1");
        card.focus({ preventScroll: true });
      }
    }
  });

  // --- Konami conga ------------------------------------------------------------------------------
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konamiIndex = 0;
  window.addEventListener("keydown", (event) => {
    konamiIndex = event.key === konami[konamiIndex] ? konamiIndex + 1 : event.key === konami[0] ? 1 : 0;
    if (konamiIndex === konami.length) {
      konamiIndex = 0;
      ctx.journey.classList.add("conga");
      window.setTimeout(() => ctx.journey.classList.remove("conga"), 1100);
    }
  });

  // --- grass rustle ---------------------------------------------------------------------------------
  const grass = document.getElementById("grass-patch");
  if (grass instanceof HTMLElement) {
    let rustling = false;
    grass.addEventListener("pointerenter", () => {
      if (rustling) {
        return;
      }
      rustling = true;
      [1, 2, 1, 0].forEach((frame, step) => {
        window.setTimeout(() => {
          grass.style.backgroundPosition = `${-frame * 96}px 0`;
          if (step === 3) {
            rustling = false;
          }
        }, step * 90);
      });
    });
  }

  // --- sound (off by default) --------------------------------------------------------------------------
  const speakerButton = document.getElementById("speaker");
  let audio: { context: AudioContext; gain: GainNode; timer: number } | null = null;

  function footstep(frame: number): void {
    if (!audio || frame % 2 !== 0) {
      return;
    }
    const { context } = audio;
    const buffer = context.createBuffer(1, 800, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const gain = context.createGain();
    gain.gain.value = 0.05;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }

  function startTune(): void {
    if (!audio) {
      return;
    }
    const { context, gain } = audio;
    const notes = [293.66, 349.23, 392, 440, 523.25, 440, 392, 349.23];
    let step = 0;
    const tick = () => {
      if (!audio) {
        return;
      }
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = (notes[step % notes.length] ?? 440) / 2;
      const noteGain = context.createGain();
      noteGain.gain.setValueAtTime(0.05, context.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
      osc.connect(noteGain).connect(gain);
      osc.start();
      osc.stop(context.currentTime + 0.55);
      step += 1;
    };
    audio.timer = window.setInterval(tick, 640);
    tick();
  }

  if (speakerButton instanceof HTMLElement) {
    speakerButton.addEventListener("click", () => {
      const on = speakerButton.getAttribute("aria-pressed") === "true";
      if (on) {
        speakerButton.setAttribute("aria-pressed", "false");
        speakerButton.setAttribute("aria-label", "Sound: off");
        if (audio) {
          window.clearInterval(audio.timer);
          void audio.context.close();
          audio = null;
        }
        return;
      }
      speakerButton.setAttribute("aria-pressed", "true");
      speakerButton.setAttribute("aria-label", "Sound: on");
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = 0.5;
      gain.connect(context.destination);
      audio = { context, gain, timer: 0 };
      startTune();
    });
  }

  // --- boot -------------------------------------------------------------------------------------------------
  let relayoutTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(relayoutTimer);
    relayoutTimer = window.setTimeout(() => {
      layout();
      if (reducedMotion.matches) {
        lastNearestStation = -1;
        reducedLoop();
      }
    }, 160);
  });

  layout();
  document.fonts?.ready.then(() => layout()).catch(() => undefined);
  window.setTimeout(layout, 400);

  if (reducedMotion.matches) {
    setSprite(trainerEl, TRAINER.idleSrc, 4, 0, 128, 128, TRAINER.scale);
    placeAt(trainerEl, pointAt(0));
    reducedLoop();
    window.addEventListener("scroll", () => reducedLoop(), { passive: true });
    forceReveal();
    window.addEventListener("scroll", () => forceReveal(), { passive: true });
  } else {
    requestAnimationFrame(frameLoop);
    // Celestial + parallax also update on scroll, so the sky arc keeps pace
    // even if rAF is throttled (e.g. a backgrounded tab).
    window.addEventListener(
      "scroll",
      () => {
        celestial();
        parallaxScenery();
      },
      { passive: true },
    );
    celestial();
  }
}

// --- helpers -------------------------------------------------------------------------

function preloadSheets(followers: Follower[]): void {
  const sources = new Set<string>([TRAINER.sheetSrc, TRAINER.idleSrc, TRAINER.waveSrc, `${SPRITES}/cairn-drop-3.png`, `${SPRITES}/cairn-4.png`, `${SPRITES}/dust.png`]);
  for (const follower of followers) {
    sources.add(follower.meta.walkSrc);
    sources.add(follower.meta.idleSrc);
  }
  for (const source of sources) {
    const image = new Image();
    image.src = source;
  }
}

function distanceAtPoint(path: SVGPathElement, total: number, point: { x: number; y: number }, pointIndex: number, pointCount: number): number {
  // Coarse-then-fine search around the proportional guess (getPointAtLength is
  // expensive; keep the call count low — this runs once per station per layout).
  const guess = (total * pointIndex) / Math.max(1, pointCount - 1);
  let windowSize = (total / Math.max(1, pointCount - 1)) * 1.6;
  let bestDistance = guess;
  for (let pass = 0; pass < 2; pass += 1) {
    let bestError = Number.POSITIVE_INFINITY;
    const center = bestDistance;
    for (let step = -6; step <= 6; step += 1) {
      const candidate = clamp(center + (step / 6) * windowSize, 0, total);
      const sample = path.getPointAtLength(candidate);
      const error = (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2;
      if (error < bestError) {
        bestError = error;
        bestDistance = candidate;
      }
    }
    windowSize /= 6;
  }
  return bestDistance;
}

function catmullRom(points: ReadonlyArray<{ x: number; y: number }>, tension = 1): string {
  const first = points[0];
  if (!first) {
    return "";
  }
  let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) {
      continue;
    }
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function lerpStops(stops: Array<[number, [number, number, number]]>, t: number): string {
  let from = stops[0];
  let to = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const a = stops[index];
    const b = stops[index + 1];
    if (a && b && t >= a[0] && t <= b[0]) {
      from = a;
      to = b;
      break;
    }
  }
  if (!from || !to) {
    return "#ede6cc";
  }
  const local = (t - from[0]) / (to[0] - from[0] || 1);
  const r = Math.round(from[1][0] + (to[1][0] - from[1][0]) * local);
  const g = Math.round(from[1][1] + (to[1][1] - from[1][1]) * local);
  const b = Math.round(from[1][2] + (to[1][2] - from[1][2]) * local);
  return `rgb(${r} ${g} ${b})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic [0,1) hash — stable scatter that survives reloads/resizes. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
