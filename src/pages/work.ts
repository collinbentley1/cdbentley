import { SITE } from "../../content/site.ts";
import { WORK_INDEX, WORK_PAGES, type WorkDemo, type WorkPage } from "../../content/work.ts";
import { escapeHtml } from "../html.ts";
import { renderPage } from "./layout.ts";

export function workIndexPage(): string {
  const cards = WORK_PAGES.map(
    (page) => `<a class="work-card card" href="/work/${page.slug}">
      <h2 class="pixel-heading">${escapeHtml(page.title)}</h2>
      <p class="work-strap">${escapeHtml(page.strap)}</p>
      <p class="work-problem">${escapeHtml(page.problem)}</p>
      <span class="pixel-chip">open →</span>
    </a>`,
  ).join("\n");

  return renderPage({
    body: `<main id="main" class="page work-index">
  <header class="page-header">
    <h1 class="pixel-title">${WORK_INDEX.title}</h1>
    <p class="page-intro">${escapeHtml(WORK_INDEX.intro)}</p>
  </header>
  <div class="work-grid">
${cards}
  </div>
</main>`,
    description: `${WORK_INDEX.intro} medlock, AVA, OTseek, runsetta, critical history.`,
    path: "/work",
    title: `The Work — ${SITE.name}`,
  });
}

export function workDetailPage(slug: string): string | null {
  const page = WORK_PAGES.find((candidate) => candidate.slug === slug);
  if (!page) {
    return null;
  }

  const links = page.links.length
    ? `<section class="work-section">
    <h2 class="pixel-heading">LINKS</h2>
    <ul class="work-links" role="list">${page.links.map((link) => `<li><a href="${link.href}" rel="noopener" target="_blank">${escapeHtml(link.label)}</a></li>`).join("")}</ul>
  </section>`
    : "";

  return renderPage({
    body: `<main id="main" class="page work-detail" data-work="${page.slug}">
  <header class="page-header">
    <p class="breadcrumb"><a href="/work">← the work</a></p>
    <h1 class="pixel-title">${escapeHtml(page.title)}</h1>
    <p class="work-strap">${escapeHtml(page.strap)}</p>
  </header>

  <section class="work-section">
    <h2 class="pixel-heading">THE PROBLEM</h2>
    <p>${escapeHtml(page.problem)}</p>
  </section>

  <section class="work-section">
    <h2 class="pixel-heading">WHAT I BUILT</h2>
    ${page.built.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n    ")}
  </section>

  <section class="work-section work-demo" aria-label="Live demo">
    <h2 class="pixel-heading demo-title">▶ ${escapeHtml(page.demoTitle)}</h2>
    ${renderDemo(page)}
  </section>

  <section class="work-section">
    <h2 class="pixel-heading">BUILD NOTES</h2>
    <ul class="build-notes" role="list">${page.buildNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
  </section>

  <section class="work-section">
    <h2 class="pixel-heading">WHAT IT TAUGHT ME</h2>
    <p class="taught">${escapeHtml(page.taught)}</p>
  </section>

  ${links}
</main>`,
    description: `${page.strap} ${page.problem}`,
    path: `/work/${page.slug}`,
    script: "work",
    title: `${page.title} — ${SITE.name}`,
  });
}

function renderDemo(page: WorkPage): string {
  const demo: WorkDemo = page.demo;
  switch (demo.kind) {
    case "medlock":
      return `<div class="demo demo-medlock" data-demo="medlock">
      <div class="demo-toolbar" role="group" aria-label="MCP tools">
        ${demo.tools.map((tool, index) => `<button class="pixel-button demo-tool" type="button" data-tool="${index}"><span class="tool-name">${escapeHtml(tool.name)}</span><span class="tool-blurb">${escapeHtml(tool.blurb)}</span></button>`).join("\n        ")}
      </div>
      <div class="terminal-pair">
        <div class="terminal" aria-live="polite"><p class="terminal-label pixel-small">→ request</p><pre class="terminal-pane" data-pane="request">click a tool to fire it</pre></div>
        <div class="terminal"><p class="terminal-label pixel-small">← response</p><pre class="terminal-pane" data-pane="response"></pre></div>
      </div>
      <div class="endpoint-block">
        <p class="pixel-small">ADD TO CLAUDE — this demo's payloads mirror the live public endpoint:</p>
        <div class="endpoint-row"><code class="endpoint" data-endpoint>${demo.endpoint}</code><button class="pixel-button" type="button" data-copy-endpoint>copy</button></div>
        <p class="demo-fineprint">The public deployment serves deterministic demo vitals only — connect it to Claude without handing over anything real.</p>
      </div>
    </div>`;
    case "ava":
      return `<div class="demo demo-ava" data-demo="ava">
      <div class="ava-layout">
        <div class="chat-pane" data-chat aria-live="polite"></div>
        <aside class="tool-pane" aria-label="Which MCP tool fired">
          <p class="terminal-label pixel-small">MCP TOOLS</p>
          <ol class="tool-list" role="list">
            ${demo.turns.map((turn, index) => `<li class="tool-step" data-step="${index}"><code>${escapeHtml(turn.tool.name)}</code><p>${escapeHtml(turn.tool.note)}</p></li>`).join("\n            ")}
          </ol>
          <div class="do-diagram" data-do-diagram aria-label="Durable Object serializing writes">
            <p class="terminal-label pixel-small">DURABLE OBJECT · itinerary</p>
            <div class="do-box"><span class="do-writer" data-do-writer>idle</span></div>
          </div>
        </aside>
      </div>
      <div class="demo-controls">
        <button class="pixel-button" type="button" data-play>▶ play the conversation</button>
        <button class="pixel-button" type="button" data-skip hidden>skip typing</button>
      </div>
      <script type="application/json" data-ava-turns>${JSON.stringify(demo.turns).replaceAll("<", "\\u003c")}</script>
    </div>`;
    case "otseek":
      return `<div class="demo demo-otseek" data-demo="otseek">
      <div class="lanes" data-lanes>
        ${demo.lanes.map((lane, index) => `<div class="lane" data-lane="${index}"><div class="lane-head"><code class="lane-branch">${escapeHtml(lane.branch)}</code><span class="lane-agent">${escapeHtml(lane.agent)}</span></div><div class="lane-track"><span class="lane-node lane-db" data-db>db</span><span class="lane-node lane-mcp" data-mcp>/_ot/${index ? `wt-${index}` : "main"}/mcp</span><span class="lane-commit" data-commit aria-hidden="true"></span></div></div>`).join("\n        ")}
      </div>
      <div class="merge-bar" data-merge><span class="merge-label pixel-small">main</span><div class="merge-track"></div></div>
      <div class="demo-controls"><button class="pixel-button" type="button" data-run>▶ spin up the worktrees</button></div>
      <p class="demo-caption margin-note">${escapeHtml(demo.caption)}</p>
    </div>`;
    case "runsetta":
      return `<div class="demo demo-runsetta" data-demo="runsetta">
      <div class="sliders">
        ${renderDemoSlider("pace", demo.pace)}
        ${renderDemoSlider("weather", demo.weather)}
        ${renderDemoSlider("mood", demo.mood)}
      </div>
      <div class="coach-output">
        <div class="speech-bubble coach-bubble" data-coach-line aria-live="polite">set the dials, coach is listening…</div>
        <button class="pixel-button" type="button" data-say>▶ hear it</button>
        <p class="demo-fineprint">voice: your browser's speech synthesis, standing in until the real recorded set lands.</p>
      </div>
      <script type="application/json" data-coach-lines>${JSON.stringify(demo.lines).replaceAll("<", "\\u003c")}</script>
    </div>`;
    case "critical-history":
      return `<div class="demo demo-history" data-demo="critical-history">
      <div class="pixel-map" data-map>
        ${demo.entries.map((entry, index) => `<button class="map-pin" type="button" data-pin="${index}" style="left:${entry.x}%;top:${entry.y}%" aria-label="${escapeHtml(entry.label)}"><span class="pin-dot"></span><span class="pin-label pixel-small">${escapeHtml(entry.label)}</span></button>`).join("\n        ")}
        <div class="map-viewport" data-viewport aria-hidden="true"></div>
      </div>
      <p class="map-note" data-map-note aria-live="polite">press play — the map flies the story in order.</p>
      <div class="demo-controls"><button class="pixel-button" type="button" data-fly>▶ fly the route</button></div>
      <p class="demo-fineprint">demo locations are placeholders; the real entries land with the project's public write-up.</p>
      <script type="application/json" data-history-entries>${JSON.stringify(demo.entries).replaceAll("<", "\\u003c")}</script>
    </div>`;
    default:
      return "";
  }
}

function renderDemoSlider(name: string, values: readonly string[]): string {
  return `<label class="demo-slider">
        <span class="slider-name pixel-small">${name}</span>
        <input type="range" min="0" max="${values.length - 1}" step="1" value="0" data-slider="${name}" aria-valuetext="${escapeHtml(values[0] ?? "")}">
        <span class="slider-value" data-slider-value="${name}">${escapeHtml(values[0] ?? "")}</span>
      </label>`;
}
