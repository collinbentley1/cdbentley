import { ENDCAP, HUD_CHIP, SCENES, TRAILHEAD, type Chip, type Scene } from "../../content/chapters.ts";
import { SITE } from "../../content/site.ts";
import { escapeHtml } from "../html.ts";
import { renderFooter, renderPage } from "./layout.ts";

export function journeyPage(): string {
  return renderPage({
    bareFooter: true,
    body: renderJourney(),
    bodyClass: "page-journey",
    description: SITE.description,
    // The walker is the LCP element; let the browser discover its first sheets immediately.
    head: `<link rel="preload" href="/assets/sprites/trainer-wave.png" as="image" fetchpriority="high">
    <link rel="preload" href="/assets/sprites/trainer-idle.png" as="image">`,
    path: "/",
    script: "journey",
    title: SITE.title,
  });
}

function renderJourney(): string {
  const scenes = SCENES.map((scene, index) => renderScene(scene, index)).join("\n");

  return `<div class="journey" id="journey">
  <div class="sky" id="sky" aria-hidden="true"></div>
  <div class="stars" id="stars" aria-hidden="true"></div>

  <main id="main" tabindex="-1">
  <header class="trailhead scene" id="scene-trailhead" data-scene="trailhead">
    <p class="hud-chip pixel-chip" id="hud">${escapeHtml(HUD_CHIP)}</p>
    <h1 class="pixel-title">${escapeHtml(TRAILHEAD.title)}</h1>
    <p class="subtitle">${escapeHtml(TRAILHEAD.subtitle)}</p>
    <p class="hud-hint" id="kbd-hint" aria-hidden="true">⌨ arrows walk</p>
    <div class="trailhead-stage">
      <div class="speech-bubble" id="hello-bubble" role="presentation">${escapeHtml(TRAILHEAD.bubble)}</div>
      <div class="hero-sprite" id="hero-sprite" aria-hidden="true"></div>
      <span class="cairn cairn-bg" style="background-image:url(/assets/sprites/cairn-1.png)" data-cairn="0"></span>
    </div>
    <p class="margin-note">${escapeHtml(TRAILHEAD.marginNote)}</p>
  </header>

  <div class="trail-layer" id="trail-layer" aria-hidden="true">
    <svg class="trail-svg" id="trail-svg" xmlns="http://www.w3.org/2000/svg">
      <path class="trail-path-shadow" id="trail-path-shadow" d=""></path>
      <path class="trail-path" id="trail-path" d=""></path>
    </svg>
    <div class="walker" id="walker"></div>
  </div>

  <ol class="scenes" id="scenes">
${scenes}
  </ol>

  <section class="endcap" id="endcap" aria-label="The story continues">
    <div class="endcap-star" aria-hidden="true">✦</div>
    <p class="endcap-tbc">${escapeHtml(ENDCAP.tbc)}</p>
    <p class="endcap-sub pixel-chip">${escapeHtml(ENDCAP.sub)}</p>
  </section>
  </main>

  <div class="grass-patch" id="grass-patch" aria-hidden="true" title="psst"></div>

  ${renderFooter()}

  <button class="speaker-toggle" id="speaker" type="button" aria-pressed="false" aria-label="Sound: off">
    <span class="speaker-icon" aria-hidden="true"></span>
  </button>
</div>`;
}

function renderScene(scene: Scene, index: number): string {
  const number = String(index + 1).padStart(2, "0");
  const side = index % 2 === 0 ? "left" : "right";
  const chips = scene.chips.map((chip) => renderChip(chip)).join("\n        ");
  const signposts = scene.signposts
    ? `<div class="signposts">${scene.signposts
        .map((signpost) => `<a class="signpost" href="${signpost.href}"><span class="signpost-art" aria-hidden="true"></span><span class="signpost-label">${escapeHtml(signpost.label)}</span></a>`)
        .join("")}</div>`
    : "";
  const buttons =
    scene.key === "now"
      ? `<nav class="now-buttons" aria-label="Explore">${ENDCAP.buttons.map((button) => `<a class="pixel-button" href="${button.href}">${button.label}</a>`).join("")}</nav>`
      : "";

  return `    <li class="scene scene-station" id="scene-${scene.key}" data-scene="${scene.key}" data-beat="${scene.beat}" data-side="${side}"${scene.companion ? ` data-companion="${scene.companion}"` : ""}>
      <div class="station" aria-hidden="true">
        <span class="cairn cairn-bg" style="background-image:url(/assets/sprites/cairn-3.png)" data-cairn="${index + 1}"></span>
        <div class="dust" data-dust></div>
      </div>
      <article class="card reveal" aria-labelledby="card-title-${scene.key}">
        <p class="card-no pixel-small">No.${number} — ${escapeHtml(scene.kicker)}</p>
        <h2 class="card-title pixel-heading" id="card-title-${scene.key}">${escapeHtml(scene.title)}</h2>
        ${scene.role ? `<p class="card-role">${escapeHtml(scene.role)}</p>` : ""}
        <p class="card-body">${escapeHtml(scene.body)}</p>
        <ul class="chips" role="list">
        ${chips}
        </ul>
        ${buttons}
      </article>
      ${signposts}
      ${scene.marginNote ? `<p class="margin-note">${escapeHtml(scene.marginNote)}</p>` : ""}
    </li>`;
}

function renderChip(chip: Chip): string {
  if (chip.level === null) {
    return `<li class="chip pixel-chip">${escapeHtml(chip.label)}</li>`;
  }
  const state = chip.mastered ? "mastered" : "acquired";
  const segments = Array.from({ length: 5 }, (_, segment) => `<span class="seg${segment < chip.level! ? " seg-on" : ""}"></span>`).join("");
  return `<li class="chip pixel-chip chip-stat" data-level="${chip.level}"${chip.mastered ? " data-mastered" : ""}>
          <span class="chip-label">${escapeHtml(chip.label)} — ${state}</span>
          <span class="chip-bar" role="img" aria-label="${escapeHtml(chip.label)}: ${chip.level} of 5">${segments}</span>
        </li>`;
}
