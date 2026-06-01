type SpriteName = "TRAINER" | "POKEBALL" | "PEAR" | "HEART" | "HOUSE" | "LAPTOP" | "HORSE";
type Point = [number, number];

type Chapter = {
  key: string;
  sprite: Exclude<SpriteName, "TRAINER" | "POKEBALL">;
  x: number;
  y: number;
  side: "left" | "right";
  color: string;
  no: string;
  title: string;
  role: string;
  type: string;
  desc: string;
  stat: {
    lab: string;
    pct: number;
  };
};

type DesktopDom = {
  node: HTMLDivElement;
  ball: HTMLDivElement;
  flash: HTMLDivElement;
  sparks: HTMLDivElement[];
  item: HTMLDivElement;
  card: HTMLDivElement;
};

type MobileDom = {
  chap: HTMLDivElement;
  badge: HTMLDivElement;
  ball: HTMLDivElement;
  flash: HTMLDivElement;
  sparks: HTMLDivElement[];
  item: HTMLDivElement;
  card: HTMLDivElement;
};

type ChapterState = Chapter & {
  desktopDom: DesktopDom | undefined;
  mobileDom: MobileDom | undefined;
  open: boolean;
};

const SPRITE_DATA: {
  palette: Record<string, string | null>;
  sprites: Record<SpriteName, readonly string[]>;
} = {
  palette: {
    " ": null,
    ".": null,
    E: "#5c8c37",
    F: "#845c38",
    G: "#96969e",
    H: "#462a18",
    J: "#26606c",
    M: "#4a96a6",
    P: "#242e46",
    Q: "#d64a6e",
    R: "#b4282e",
    S: "#d6a680",
    W: "#c8cdd2",
    X: "#363c50",
    Z: "#1c3460",
    a: "#f5ecd6",
    b: "#3e312a",
    c: "#ec5c60",
    d: "#3c342e",
    e: "#7cb64e",
    f: "#ac8054",
    g: "#e0e0e4",
    h: "#684228",
    j: "#3c8c96",
    k: "#18161e",
    l: "#7a5434",
    m: "#78cdd6",
    n: "#96d278",
    o: "#262230",
    p: "#34405c",
    q: "#ff7894",
    r: "#e43a3e",
    s: "#f5cda5",
    t: "#6eaa5a",
    u: "#fafafa",
    w: "#f4f4ee",
    x: "#586078",
    y: "#f4ce54",
    z: "#284880",
  },
  sprites: {
    TRAINER: [
      "      oooooo    ",
      "    ooHHHHHHoo  ",
      "   oHHHHHHHHHo  ",
      "   oHhhhhhhhHo  ",
      "   oHhssssshHo  ",
      "   ohsssssssho  ",
      "   ohsosssosho  ",
      "   ohssoossssho ",
      "   ohsssssssho  ",
      "    oSsssssSo   ",
      "    ooSsssSoo   ",
      "   ojjowwojjjo  ",
      "  ojjjjwwjjjjjo ",
      "  ojJjjwwjjjJjo ",
      "  ojJjjwwjjjJjo ",
      "  oojJjwwjJjooo ",
      "   opppppppp o  ",
      "   oppoopppoo   ",
      "   oppo oppo    ",
      "   obbo obbo    ",
    ],
    POKEBALL: [
      "                ",
      "    oooooooo    ",
      "   oorrrrrroo   ",
      "  orrrrrrrrrro  ",
      " oorrrrrrrrrroo ",
      " orrrrroorrrrro ",
      " orrrroggorrrro ",
      " kkkkoggggokkkk ",
      " kkkkoggggokkkk ",
      " owwwwoggowwwwo ",
      " owwwwwoowwwwwo ",
      " oowwwwwwwwwwoo ",
      "  owwwwwwwwwwo  ",
      "   oowwwwwwoo   ",
      "    oooooooo    ",
      "                ",
    ],
    PEAR: [
      "        ll      ",
      "       lnl      ",
      "      lnnl      ",
      "      oeeo      ",
      "     oeyeeo     ",
      "    oeyeeeeo    ",
      "   oeyeeeeeeo   ",
      "  oeyeeeeeeeeo  ",
      "  oeeeeeeeeeEo  ",
      "  oeeeeeeeeeEo  ",
      "  oeeeeeeeeEEo  ",
      "   oeeeeeEEEo   ",
      "   oeeeeEEEo    ",
      "    oeeEEEo     ",
      "     oEEEo      ",
      "      ooo       ",
    ],
    HEART: [
      "                ",
      "   ooo   ooo    ",
      "  oqqqo oqqqo   ",
      " oqqqqqoqqqqqo  ",
      " oquqqqqqqqqqo  ",
      " oquqqqqqqqqqo  ",
      " oqqqqqqqqqQQo  ",
      "  oqqqqqqqQQo   ",
      "   oqqqqqQQo    ",
      "    oqqqQQo     ",
      "     oqQQo      ",
      "      oQo       ",
      "       o        ",
      "   m   m   m    ",
      "  m m m m m m   ",
      "   m   m   m    ",
    ],
    HOUSE: [
      "       oo       ",
      "      orro      ",
      "     orrrro     ",
      "    orrrrrro    ",
      "   orrrrrrrro   ",
      "  orrrrrrrrrro  ",
      " orrrrrrrrrrrro ",
      " owwwwwwwwwwwwo ",
      " owwwwoccowwwwo ",
      " owwwocccco wwo ",
      " owwoccccccowwo ",
      " owwwocccco wwo ",
      " owwwwoccowwwwo ",
      " owwwwwwwwwwwwo ",
      " owwddwwwwddwwo ",
      "  oooooooooooo  ",
    ],
    LAPTOP: [
      "                ",
      "  oooooooooooo  ",
      "  oXtttttttttXo ",
      "  oXt ott t tXo ",
      "  oXtto ottttXo ",
      "  oXt o ottttXo ",
      "  oXtttto otXXo ",
      "  oXttt ottttXo ",
      "  oXtttttttttXo ",
      "  oXXXXXXXXXXXo ",
      " oxxxxxxxxxxxxo ",
      " oxxxxxxxxxxxxo ",
      "oxxxxxxxxxxxxxxo",
      "oxxxxxxxxxxxxxxo",
      " oXXXXXXXXXXXXo ",
      "  oooooooooooo  ",
    ],
    HORSE: [
      "            ooo ",
      "          ooFFFo",
      "         oFffFFo",
      "        oFfffFoo",
      "   oo   oFfffo  ",
      "  oFFoo oFffo   ",
      "  oFffFooffffo  ",
      "  offfffffffffo ",
      " offffffffffffo ",
      " offffffffffffo ",
      " ofFffffffffFfo ",
      " ofo ofo ofo ofo",
      " ofo ofo ofo ofo",
      " obo obo obo obo",
      "                ",
      "                ",
    ],
  },
};

const STAGE_W = 920;
const STAGE_H = 2900;
const HAND = { x: 176, y: 252 };
const START = { x: 470, y: 150 };

const CHAPTERS: ChapterState[] = [
  {
    key: "pearx",
    sprite: "PEAR",
    x: 658,
    y: 372,
    side: "left",
    color: "var(--pearx)",
    no: "No.01",
    title: "PEARX",
    role: "Founder",
    type: "FOUNDER / GRIT",
    desc: "Caught the startup bug and never recovered. Building in the PearX accelerator — turning bold ideas into products that actually ship.",
    stat: { lab: "GRIT", pct: 95 },
    desktopDom: undefined,
    mobileDom: undefined,
    open: false,
  },
  {
    key: "healthyr",
    sprite: "HEART",
    x: 252,
    y: 880,
    side: "right",
    color: "var(--healthyr)",
    no: "No.02",
    title: "HEALTHYR",
    role: "Voice AI Companion",
    type: "VOICE / CARE",
    desc: "A warm voice that checks in on patients, listens, and keeps care continuous in the long quiet between appointments.",
    stat: { lab: "CARE", pct: 90 },
    desktopDom: undefined,
    mobileDom: undefined,
    open: false,
  },
  {
    key: "humana",
    sprite: "HOUSE",
    x: 686,
    y: 1392,
    side: "left",
    color: "var(--humana)",
    no: "No.03",
    title: "HUMANA",
    role: "Ambient AI · Home Health",
    type: "AMBIENT / HEALTH",
    desc: "Quietly captures home-health visits so nurses can focus on the person in front of them instead of the paperwork after.",
    stat: { lab: "FOCUS", pct: 85 },
    desktopDom: undefined,
    mobileDom: undefined,
    open: false,
  },
  {
    key: "yale",
    sprite: "LAPTOP",
    x: 236,
    y: 1904,
    side: "right",
    color: "var(--yale)",
    no: "No.04",
    title: "YALE",
    role: "Computer Science",
    type: "CS / LOGIC",
    desc: "Studied Computer Science at Yale — algorithms by day, building things that matter by night. Where the toolkit was forged.",
    stat: { lab: "LOGIC", pct: 88 },
    desktopDom: undefined,
    mobileDom: undefined,
    open: false,
  },
  {
    key: "equine",
    sprite: "HORSE",
    x: 642,
    y: 2412,
    side: "left",
    color: "var(--equine)",
    no: "No.05",
    title: "EQUINE THERAPY",
    role: "Riding & Therapy Instructor",
    type: "EQUINE / TRUST",
    desc: "The earliest evolution: taught riding and equine-assisted therapy. First lessons in patience, trust, and reading what is not said.",
    stat: { lab: "TRUST", pct: 92 },
    desktopDom: undefined,
    mobileDom: undefined,
    open: false,
  },
];

const wrap = getHtmlElement("wrap");
const stage = getHtmlElement("stage");
const mroot = getHtmlElement("mroot");
const MQ = window.matchMedia("(max-width: 760px)");
let curMode: "desktop" | "mobile" | null = null;
let ctl: AbortController | null = null;

applyMode();
window.addEventListener("resize", applyMode);
MQ.addEventListener("change", applyMode);

function buildSprite(name: SpriteName, scale: number): HTMLCanvasElement {
  const grid = SPRITE_DATA.sprites[name];
  const height = grid.length;
  const width = Math.max(...grid.map((row) => row.length));
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }

  context.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y += 1) {
    const row = grid[y] ?? "";
    for (let x = 0; x < row.length; x += 1) {
      const color = SPRITE_DATA.palette[row[x] ?? " "];
      if (color) {
        context.fillStyle = color;
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  return canvas;
}

function buildDesktop(signal: AbortSignal): void {
  wrap.style.display = "";
  mroot.style.display = "none";
  stage.querySelectorAll(".node").forEach((node) => node.remove());
  document.getElementById("flyball")?.remove();
  resetChapters();

  const trainerEl = getHtmlElement("trainer");
  const bubbleEl = getHtmlElement("bubble");
  trainerEl.className = "";
  trainerEl.style.opacity = "0";
  bubbleEl.className = "";

  if (!trainerEl.querySelector("canvas")) {
    const trainerSprite = buildSprite("TRAINER", 8);
    trainerSprite.style.position = "absolute";
    trainerSprite.style.left = "0";
    trainerSprite.style.top = "0";
    trainerEl.prepend(trainerSprite);
  }

  stage.style.height = `${STAGE_H}px`;
  getHtmlElement("endmark").style.top = "2640px";

  const svg = getSvgElement("routeSvg");
  const route = getSvgPathElement("route");
  const routeShadow = getSvgPathElement("routeShadow");
  svg.setAttribute("width", String(STAGE_W));
  svg.setAttribute("height", String(STAGE_H));
  svg.setAttribute("viewBox", `0 0 ${STAGE_W} ${STAGE_H}`);

  const routePoints = [[START.x, START.y] as Point].concat(CHAPTERS.map((chapter) => [chapter.x, chapter.y] as Point), [[470, 2760] as Point]);
  const routePath = catmullRom(routePoints);
  route.setAttribute("d", routePath);
  routeShadow.setAttribute("d", routePath);

  const totalLength = route.getTotalLength();
  route.style.strokeDasharray = `${totalLength}`;
  route.style.strokeDashoffset = `${totalLength}`;
  routeShadow.style.strokeDasharray = `${totalLength}`;
  routeShadow.style.strokeDashoffset = `${totalLength}`;

  for (const chapter of CHAPTERS) {
    const node = div("node");
    node.style.left = `${chapter.x}px`;
    node.style.top = `${chapter.y}px`;
    node.dataset.key = chapter.key;
    node.append(div("platform"));

    const direction = chapter.side === "left" ? -1 : 1;
    const leader = div("leader");
    leader.style.top = "0px";
    leader.style.width = "52px";
    if (direction < 0) {
      leader.style.right = "12px";
    } else {
      leader.style.left = "12px";
    }
    node.append(leader);

    const flash = div("flash");
    node.append(flash);

    const sparks = createSparks("spark", 8, 46);
    node.append(...sparks);

    const item = div("itemSprite");
    item.append(buildSprite(chapter.sprite, 6));
    node.append(item);

    const ball = div("ball");
    ball.append(buildSprite("POKEBALL", 4));
    node.append(ball);

    const card = div(`card ${direction < 0 ? "left" : "right"}`);
    card.style.setProperty("--rot", direction < 0 ? "1.4deg" : "-1.4deg");
    card.style.left = direction < 0 ? "-364px" : "64px";
    card.style.top = "-92px";
    card.innerHTML = cardHtml(chapter);
    node.append(card);

    stage.append(node);
    chapter.desktopDom = { node, ball, flash, sparks, item, card };
  }

  const first = CHAPTERS[0];
  if (first?.desktopDom) {
    first.desktopDom.ball.style.display = "none";
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target;
        if (!entry.isIntersecting || !(target instanceof HTMLElement)) {
          continue;
        }

        const chapter = CHAPTERS.find((candidate) => candidate.key === target.dataset.key);
        if (chapter && chapter.key !== "pearx") {
          openDesktopChapter(chapter, signal);
        }
      }
    },
    { rootMargin: "0px 0px -32% 0px", threshold: 0.2 },
  );

  for (const chapter of CHAPTERS.slice(1)) {
    if (chapter.desktopDom) {
      observer.observe(chapter.desktopDom.node);
      chapter.desktopDom.ball.classList.add("idle");
    }
  }

  signal.addEventListener("abort", () => observer.disconnect());

  function fit(): void {
    const scale = Math.min(1, (window.innerWidth - 24) / STAGE_W);
    stage.style.transform = `translateX(-50%) scale(${scale})`;
    wrap.style.height = `${STAGE_H * scale}px`;
    onScroll();
  }

  function onScroll(): void {
    const rect = stage.getBoundingClientRect();
    const progress = clamp((window.innerHeight * 0.55 - rect.top) / rect.height, 0, 1);
    const offset = totalLength * (1 - progress);
    route.style.strokeDashoffset = `${offset}`;
    routeShadow.style.strokeDashoffset = `${offset}`;
    getHtmlElement("scrollHint").style.opacity = window.scrollY > 120 ? "0" : "1";
    maybeRevealDesktop(signal);
  }

  function intro(): void {
    if (signal.aborted) {
      return;
    }

    trainerEl.style.opacity = "1";
    window.setTimeout(() => {
      if (!signal.aborted) {
        bubbleEl.classList.add("show");
      }
    }, 900);
    window.setTimeout(() => {
      if (!signal.aborted) {
        trainerEl.classList.add("bob");
      }
    }, 1250);
    window.setTimeout(() => {
      if (!signal.aborted) {
        trainerEl.classList.remove("bob");
        trainerEl.classList.add("windup");
      }
    }, 1700);
    window.setTimeout(() => flyDesktopBall(signal), 2050);
    window.setTimeout(() => {
      if (!signal.aborted) {
        trainerEl.classList.remove("windup");
        trainerEl.classList.add("throwidle");
      }
    }, 2900);
  }

  window.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", fit, { signal });
  fit();
  onScroll();
  startWhenReady(intro, signal);
}

function buildMobile(signal: AbortSignal): void {
  mroot.style.display = "";
  wrap.style.display = "none";
  mroot.replaceChildren();
  resetChapters();

  const banner = div();
  banner.id = "mbanner";
  banner.innerHTML = `<div class="kicker">★ A WILD PORTFOLIO APPEARED ★</div><h1>COLLIN</h1>`;
  mroot.append(banner);

  const introEl = div();
  introEl.id = "mintro";

  const trainer = div();
  trainer.id = "mtrainer";
  trainer.append(buildSprite("TRAINER", 6), div("shadow"));
  const tag = div("tag");
  tag.textContent = "▶ TRAINER · LV.∞";
  trainer.append(tag);

  const bubble = div();
  bubble.id = "mbubble";
  bubble.innerHTML = `Hi, I'm Collin<span style="color:#b54b3a">!</span>`;
  introEl.append(trainer, bubble);
  mroot.append(introEl);

  const trail = div();
  trail.id = "mtrail";
  const mobileSvg = createMobileRouteSvg();
  trail.append(mobileSvg.svg);

  const badges: HTMLDivElement[] = [];
  for (const chapter of CHAPTERS) {
    const chap = div("mchap");
    chap.dataset.key = chapter.key;
    chap.append(div("mlead"));

    const badge = div("mbadge");
    badge.append(div("mplat"));

    const flash = div("mflash");
    badge.append(flash);

    const sparks = createSparks("mspark", 8, 34);
    badge.append(...sparks);

    const item = div("mitem");
    item.append(buildSprite(chapter.sprite, 4));
    badge.append(item);

    const ball = div("mball");
    ball.append(buildSprite("POKEBALL", 3));
    badge.append(ball);

    chap.append(badge);

    const card = div("mcard");
    card.innerHTML = cardHtml(chapter);
    chap.append(card);

    trail.append(chap);
    badges.push(badge);
    chapter.mobileDom = { chap, badge, ball, flash, sparks, item, card };
  }

  mroot.append(trail);

  const foot = div();
  foot.id = "mfoot";
  foot.innerHTML = `<div class="star">✦</div><div class="tbc">to be continued…</div><div class="sub">THE STORY KEEPS LEVELING UP</div>`;
  mroot.append(foot);

  const first = CHAPTERS[0];
  if (first?.mobileDom) {
    first.mobileDom.ball.style.display = "none";
  }

  for (const chapter of CHAPTERS.slice(1)) {
    chapter.mobileDom?.ball.classList.add("idle");
  }

  let mobileRouteLength = 0;
  let introDone = false;

  function drawRoute(): void {
    const trailRect = trail.getBoundingClientRect();
    const width = trail.offsetWidth;
    const height = trail.offsetHeight;
    mobileSvg.svg.setAttribute("width", String(width));
    mobileSvg.svg.setAttribute("height", String(height));
    mobileSvg.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    mobileSvg.svg.style.width = `${width}px`;
    mobileSvg.svg.style.height = `${height}px`;
    mobileSvg.filter.setAttribute("height", `${height + 40}`);

    const gutter = 40;
    const centers = badges.map((badge) => {
      const rect = badge.getBoundingClientRect();
      return rect.top - trailRect.top + rect.height * 0.46;
    });
    const points: Point[] = [[gutter, 4]];
    centers.forEach((center, index) => {
      if (index > 0) {
        const previous = centers[index - 1];
        if (previous !== undefined) {
          points.push([gutter + (index % 2 ? 17 : -15), (previous + center) / 2]);
        }
      }
      points.push([gutter, center]);
    });
    points.push([gutter, height - 4]);

    const routePath = catmullRom(points);
    mobileSvg.ink.setAttribute("d", routePath);
    mobileSvg.shadow.setAttribute("d", routePath);
    mobileRouteLength = mobileSvg.ink.getTotalLength();
    mobileSvg.ink.style.strokeDasharray = `${mobileRouteLength}`;
    mobileSvg.shadow.style.strokeDasharray = `${mobileRouteLength}`;
    drawProgress();
  }

  function drawProgress(): void {
    const rect = trail.getBoundingClientRect();
    const progress = clamp((window.innerHeight * 0.62 - rect.top) / rect.height, 0, 1);
    const offset = mobileRouteLength * (1 - progress);
    mobileSvg.ink.style.strokeDashoffset = `${offset}`;
    mobileSvg.shadow.style.strokeDashoffset = `${offset}`;
  }

  function maybeReveal(): void {
    if (!introDone) {
      return;
    }

    const revealLine = window.innerHeight * 0.58;
    for (const chapter of CHAPTERS.slice(1)) {
      if (chapter.open || !chapter.mobileDom) {
        continue;
      }

      if (chapter.mobileDom.badge.getBoundingClientRect().top < revealLine) {
        openMobileChapter(chapter, signal);
      }
    }
  }

  function intro(): void {
    if (signal.aborted) {
      return;
    }

    trainer.classList.add("in");
    window.setTimeout(() => {
      if (!signal.aborted) {
        bubble.classList.add("show");
      }
    }, 650);
    window.setTimeout(() => {
      if (!signal.aborted) {
        trainer.classList.remove("in");
        trainer.classList.add("windup");
      }
    }, 1500);
    window.setTimeout(() => throwMobileBall(trainer, signal, () => {
      introDone = true;
      maybeReveal();
    }), 1850);
    window.setTimeout(() => {
      if (!signal.aborted) {
        trainer.classList.remove("windup");
        trainer.classList.add("in");
        introDone = true;
        maybeReveal();
      }
    }, 3150);
  }

  window.addEventListener(
    "scroll",
    () => {
      drawProgress();
      maybeReveal();
    },
    { passive: true, signal },
  );
  window.addEventListener(
    "resize",
    () => {
      drawRoute();
      maybeReveal();
    },
    { signal },
  );

  drawRoute();
  window.setTimeout(() => {
    if (!signal.aborted) {
      drawRoute();
    }
  }, 140);
  document.fonts.ready.then(() => {
    if (!signal.aborted) {
      drawRoute();
    }
  });
  startWhenReady(intro, signal);
}

function flyDesktopBall(signal: AbortSignal): void {
  const first = CHAPTERS[0];
  if (!first?.desktopDom || signal.aborted) {
    return;
  }
  const firstChapter = first;

  const flyball = div();
  flyball.id = "flyball";
  const sprite = buildSprite("POKEBALL", 4);
  flyball.append(sprite);
  flyball.style.left = `${HAND.x}px`;
  flyball.style.top = `${HAND.y}px`;
  stage.append(flyball);

  const startX = HAND.x;
  const startY = HAND.y;
  const targetX = first.x;
  const targetY = first.y;
  const duration = 820;
  const peak = 215;
  const startedAt = performance.now();

  function frame(now: number): void {
    if (signal.aborted) {
      flyball.remove();
      return;
    }

    const time = Math.min(1, (now - startedAt) / duration);
    const x = startX + (targetX - startX) * time;
    const y = startY + (targetY - startY) * time - peak * Math.sin(Math.PI * time);
    flyball.style.left = `${x}px`;
    flyball.style.top = `${y}px`;
    sprite.style.transform = `rotate(${(720 * time).toFixed(0)}deg)`;

    if (time < 1) {
      requestAnimationFrame(frame);
      return;
    }

    flyball.style.left = `${targetX}px`;
    flyball.style.top = `${targetY}px`;
    sprite.style.transform = "";
    flyball.classList.add("wobble");
    window.setTimeout(() => {
      if (!signal.aborted) {
        flyball.classList.add("gone");
        firstChapter.open = true;
        revealDesktop(firstChapter);
      }
    }, 560);
  }

  requestAnimationFrame(frame);
}

function throwMobileBall(trainer: HTMLDivElement, signal: AbortSignal, done: () => void): void {
  const first = CHAPTERS[0];
  if (!first?.mobileDom || signal.aborted) {
    return;
  }
  const firstChapter = first;

  const flyball = div();
  flyball.id = "mflyball";
  const sprite = buildSprite("POKEBALL", 3);
  flyball.append(sprite);
  mroot.append(flyball);

  const rootRect = mroot.getBoundingClientRect();
  const trainerRect = trainer.getBoundingClientRect();
  const badgeRect = first.mobileDom.badge.getBoundingClientRect();
  const startX = trainerRect.left + trainerRect.width * 0.62 - rootRect.left;
  const startY = trainerRect.top + trainerRect.height * 0.4 - rootRect.top;
  const targetX = badgeRect.left + badgeRect.width * 0.5 - rootRect.left;
  const targetY = badgeRect.top + badgeRect.height * 0.46 - rootRect.top;
  const duration = 780;
  const peak = Math.max(70, (targetY - startY) * 0.45 + 40);
  const startedAt = performance.now();

  function frame(now: number): void {
    if (signal.aborted) {
      flyball.remove();
      return;
    }

    const time = Math.min(1, (now - startedAt) / duration);
    const x = startX + (targetX - startX) * time;
    const y = startY + (targetY - startY) * time - peak * Math.sin(Math.PI * time);
    flyball.style.left = `${x}px`;
    flyball.style.top = `${y}px`;
    sprite.style.transform = `rotate(${Math.trunc(680 * time)}deg)`;

    if (time < 1) {
      requestAnimationFrame(frame);
      return;
    }

    flyball.style.left = `${targetX}px`;
    flyball.style.top = `${targetY}px`;
    sprite.style.transform = "";
    flyball.classList.add("land");
    window.setTimeout(() => {
      if (!signal.aborted) {
        flyball.style.transition = "all .25s ease";
        flyball.style.opacity = "0";
        flyball.style.transform = "translate(-50%,-50%) scale(.3)";
        firstChapter.open = true;
        revealMobile(firstChapter);
        done();
      }
    }, 470);
  }

  requestAnimationFrame(frame);
}

function openDesktopChapter(chapter: ChapterState, signal: AbortSignal): void {
  if (chapter.open || !chapter.desktopDom) {
    return;
  }

  chapter.open = true;
  chapter.desktopDom.ball.classList.remove("idle");
  chapter.desktopDom.ball.classList.add("wobble");
  window.setTimeout(() => {
    if (!signal.aborted && chapter.desktopDom) {
      chapter.desktopDom.ball.classList.add("gone");
      revealDesktop(chapter);
    }
  }, 560);
}

function maybeRevealDesktop(signal: AbortSignal): void {
  const revealLine = window.innerHeight * 0.72;
  for (const chapter of CHAPTERS.slice(1)) {
    if (chapter.open || !chapter.desktopDom) {
      continue;
    }

    if (chapter.desktopDom.node.getBoundingClientRect().top < revealLine) {
      openDesktopChapter(chapter, signal);
    }
  }
}

function openMobileChapter(chapter: ChapterState, signal: AbortSignal): void {
  if (chapter.open || !chapter.mobileDom) {
    return;
  }

  chapter.open = true;
  chapter.mobileDom.ball.classList.remove("idle");
  chapter.mobileDom.ball.classList.add("wob");
  window.setTimeout(() => {
    if (!signal.aborted && chapter.mobileDom) {
      chapter.mobileDom.ball.classList.add("gone");
      revealMobile(chapter);
    }
  }, 520);
}

function revealDesktop(chapter: ChapterState): void {
  if (!chapter.desktopDom) {
    return;
  }

  chapter.desktopDom.node.classList.add("open");
  chapter.desktopDom.flash.classList.add("go");
  chapter.desktopDom.sparks.forEach((spark) => spark.classList.add("go"));
  chapter.desktopDom.item.classList.add("show");
  chapter.desktopDom.card.classList.add("show");
  fillStat(chapter.desktopDom.card);
}

function revealMobile(chapter: ChapterState): void {
  if (!chapter.mobileDom) {
    return;
  }

  chapter.mobileDom.chap.classList.add("open");
  chapter.mobileDom.flash.classList.add("go");
  chapter.mobileDom.sparks.forEach((spark) => spark.classList.add("go"));
  chapter.mobileDom.item.classList.add("show");
  chapter.mobileDom.card.classList.add("show");
  fillStat(chapter.mobileDom.card);
}

function fillStat(card: HTMLElement): void {
  const bar = card.querySelector<HTMLElement>(".bar i");
  if (!bar) {
    return;
  }

  requestAnimationFrame(() => {
    bar.style.width = `${bar.dataset.pct ?? "0"}%`;
  });
}

function cardHtml(chapter: Chapter): string {
  return `
  <div class="tape"></div>
  <div class="no">${chapter.no}</div>
  <h2>${chapter.title}</h2>
  <div class="role" style="color:${chapter.color}">${chapter.role}</div>
  <p>${chapter.desc}</p>
  <span class="badge" style="background:${chapter.color}">${chapter.type}</span>
  <div class="statline">
    <span class="lab">${chapter.stat.lab}</span>
    <span class="bar"><i style="background:${chapter.color}" data-pct="${chapter.stat.pct}"></i></span>
  </div>`;
}

function catmullRom(points: readonly Point[], tension = 1): string {
  const first = points[0];
  if (!first) {
    return "";
  }

  let path = `M ${first[0]} ${first[1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;

    if (!p0 || !p1 || !p2 || !p3) {
      continue;
    }

    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }

  return path;
}

function createSparks(className: string, count: number, baseDistance: number): HTMLDivElement[] {
  return Array.from({ length: count }, (_, index) => {
    const spark = div(className);
    const angle = ((Math.PI * 2) / count) * index + 0.3;
    const distance = baseDistance + (index % 2 ? 10 : 0);
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    return spark;
  });
}

function createMobileRouteSvg(): {
  svg: SVGSVGElement;
  filter: SVGFilterElement;
  shadow: SVGPathElement;
  ink: SVGPathElement;
} {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("class", "mroute");

  const defs = document.createElementNS(namespace, "defs");
  const filter = document.createElementNS(namespace, "filter");
  filter.id = "mrough";
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("x", "-30");
  filter.setAttribute("y", "-20");
  filter.setAttribute("width", "160");
  filter.setAttribute("height", "100");

  const turbulence = document.createElementNS(namespace, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", "0.016 0.012");
  turbulence.setAttribute("numOctaves", "2");
  turbulence.setAttribute("seed", "4");
  turbulence.setAttribute("result", "n");

  const displacement = document.createElementNS(namespace, "feDisplacementMap");
  displacement.setAttribute("in", "SourceGraphic");
  displacement.setAttribute("in2", "n");
  displacement.setAttribute("scale", "5");
  displacement.setAttribute("xChannelSelector", "R");
  displacement.setAttribute("yChannelSelector", "G");

  filter.append(turbulence, displacement);
  defs.append(filter);

  const shadow = document.createElementNS(namespace, "path");
  shadow.setAttribute("fill", "none");
  shadow.setAttribute("stroke", "rgba(58,42,30,.18)");
  shadow.setAttribute("stroke-width", "9");
  shadow.setAttribute("stroke-linecap", "round");
  shadow.setAttribute("filter", "url(#mrough)");
  shadow.setAttribute("class", "mrShadow");

  const ink = document.createElementNS(namespace, "path");
  ink.setAttribute("fill", "none");
  ink.setAttribute("stroke", "#3a3140");
  ink.setAttribute("stroke-width", "6");
  ink.setAttribute("stroke-linecap", "round");
  ink.setAttribute("filter", "url(#mrough)");
  ink.setAttribute("class", "mrInk");

  svg.append(defs, shadow, ink);
  return { svg, filter, shadow, ink };
}

function div(className?: string): HTMLDivElement {
  const element = document.createElement("div");
  if (className) {
    element.className = className;
  }
  return element;
}

function getHtmlElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element: ${id}`);
  }
  return element;
}

function getSvgElement(id: string): SVGSVGElement {
  const element = document.getElementById(id);
  if (!(element instanceof SVGSVGElement)) {
    throw new Error(`Missing svg: ${id}`);
  }
  return element;
}

function getSvgPathElement(id: string): SVGPathElement {
  const element = document.getElementById(id);
  if (!(element instanceof SVGPathElement)) {
    throw new Error(`Missing path: ${id}`);
  }
  return element;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resetChapters(): void {
  for (const chapter of CHAPTERS) {
    chapter.open = false;
    chapter.desktopDom = undefined;
    chapter.mobileDom = undefined;
  }
}

function startWhenReady(callback: () => void, signal: AbortSignal): void {
  if (document.readyState === "complete") {
    window.setTimeout(callback, 60);
    return;
  }

  window.addEventListener("load", callback, { once: true, signal });
}

function applyMode(): void {
  const nextMode = MQ.matches ? "mobile" : "desktop";
  if (nextMode === curMode) {
    return;
  }

  ctl?.abort();
  curMode = nextMode;
  ctl = new AbortController();

  if (nextMode === "desktop") {
    buildDesktop(ctl.signal);
  } else {
    buildMobile(ctl.signal);
  }
}
