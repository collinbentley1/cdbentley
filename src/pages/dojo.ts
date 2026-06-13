import { DOJO_HEADER, END, ITEMS, PREMISE } from "../../content/dojo.ts";
import { SITE } from "../../content/site.ts";
import { escapeHtml } from "../html.ts";
import { renderPage } from "./layout.ts";

export function dojoPage(): string {
  return renderPage({
    body: renderDojo(),
    bodyClass: "page-dojo",
    description: `${DOJO_HEADER.title} — Find the Flaw. Ten confident answers, each hiding one planted mistake. ${DOJO_HEADER.subhead}`,
    path: "/dojo",
    script: "dojo",
    title: `The Dojo — ${SITE.name}`,
  });
}

function renderDojo(): string {
  return `<main id="main" tabindex="-1" class="page dojo" data-dojo>
  <header class="dojo-header">
    <h1 class="pixel-title">${DOJO_HEADER.title}</h1>
    <p class="dojo-tagline">— ${escapeHtml(DOJO_HEADER.titleSuffix)}</p>
    <p class="dojo-subhead">${escapeHtml(DOJO_HEADER.subhead)}</p>
  </header>

  <div class="dojo-room">
    <div class="dojo-wall" aria-hidden="true">
      <img class="dojo-scroll pixel-img" src="/assets/sprites/dojo-scroll.png" alt="" width="88" height="200">
      <div class="sensei" id="sensei">
        <img class="pixel-img" src="/assets/sprites/sensei.png" alt="" width="128" height="128">
      </div>
      <div class="speech-bubble sensei-bubble" id="sensei-bubble" aria-hidden="true">…</div>
    </div>

    <div class="dojo-floor">
      <section class="dojo-screen screen-active" data-screen="intro" aria-label="Find the flaw">
        <h2 class="pixel-heading">FIND THE FLAW</h2>
        <p class="screen-lede">${escapeHtml(PREMISE.body)}</p>
        <div class="screen-next"><button class="pixel-button next-button" type="button" data-start>${escapeHtml(PREMISE.start)}</button></div>
      </section>

      <section class="dojo-screen" data-screen="play" aria-label="Catch the planted flaw" hidden>
        <div class="play-status">
          <ol class="dojo-dots" role="list" aria-label="Progress">${ITEMS.map((_, index) => `<li class="dot" data-dot="${index}"></li>`).join("")}</ol>
          <p class="play-meta"><span class="pixel-small" data-item-counter>ITEM 1 / ${ITEMS.length}</span> <span class="pixel-chip difficulty-chip" data-difficulty>easy</span></p>
        </div>
        <div class="flaw-answer" data-answer-box aria-live="polite"></div>
        <div class="verdict" data-verdict-box hidden aria-live="polite">
          <p class="verdict-line" data-verdict-line></p>
          <p class="verdict-category pixel-small" data-verdict-category></p>
          <p class="verdict-explanation" data-verdict-explanation></p>
          <div class="screen-next"><button class="pixel-button next-button" type="button" data-next-item>NEXT →</button></div>
        </div>
      </section>

      <section class="dojo-screen" data-screen="end" aria-label="Your score" hidden>
        <div class="levelup-stage">
          <span class="cairn cairn-bg" data-dojo-cairn style="background-image:url(/assets/sprites/cairn-3.png)"></span>
          <p class="levelup-title pixel-heading">${escapeHtml(END.title)}</p>
        </div>
        <p class="end-closing" data-end-closing></p>
        <ul class="scorecard" role="list">
          <li><strong class="pixel-small">ROUNDS</strong><p data-end-rounds></p></li>
          <li><strong class="pixel-small">SPEED</strong><p data-end-speed></p></li>
          <li><strong class="pixel-small">FAILURE MODES</strong><p data-end-categories></p></li>
        </ul>
        <p class="end-delta margin-note" data-end-delta hidden></p>
        <div class="screen-next"><button class="pixel-button" type="button" data-replay>${escapeHtml(END.replay)}</button></div>
        <p class="honest-line">${escapeHtml(END.honest)}</p>
        <nav class="now-buttons" aria-label="Where next">
          ${END.buttons.map((button) => `<a class="pixel-button" href="${button.href}">${escapeHtml(button.label)}</a>`).join("\n          ")}
        </nav>
      </section>

      <noscript><p class="screen-lede">The dojo is an interactive exercise and needs JavaScript — everything it teaches is also in <a href="/notes/riding-instructors">the essay</a>.</p></noscript>
    </div>
  </div>
</main>`;
}
