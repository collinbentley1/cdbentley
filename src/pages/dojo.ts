import { BASE_PROMPT, DOJO_HEADER, FEAR_LEVELS, FORMATS, GROUP_SIZES, LEVEL_UP, ROLES, SCREEN_LABELS } from "../../content/dojo.ts";
import { SITE } from "../../content/site.ts";
import { escapeHtml } from "../html.ts";
import { renderPage } from "./layout.ts";

export function dojoPage(): string {
  return renderPage({
    body: renderDojo(),
    bodyClass: "page-dojo",
    description: `${DOJO_HEADER.title} — ${DOJO_HEADER.titleSuffix} ${DOJO_HEADER.subhead}`,
    path: "/dojo",
    script: "dojo",
    title: `The Dojo — ${SITE.name}`,
  });
}

function renderDojo(): string {
  const steps = SCREEN_LABELS.map((label, index) => `<li class="dojo-step${index === 0 ? " step-active" : ""}" data-step-marker="${index}"><span class="step-dot"></span><span class="step-label pixel-small">${escapeHtml(label)}</span></li>`).join("");

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
      <ol class="dojo-steps" role="list" aria-label="Progress">${steps}</ol>

      <div class="prompt-pane" aria-label="The prompt so far">
        <p class="terminal-label pixel-small">YOUR PROMPT</p>
        <p class="prompt-text" data-prompt-text><span class="prompt-base">${escapeHtml(BASE_PROMPT)}</span></p>
      </div>

      <section class="dojo-screen screen-active" data-screen="0" aria-label="Try it">
        <p class="screen-lede">Riverbot, a trip-planning assistant, got the prompt above. Here's what came back:</p>
        <div class="riverbot-answer" data-answer="0" aria-live="polite"></div>
        <div class="rate-row" data-rate-row hidden>
          <p class="rate-label pixel-small">Rate this answer:</p>
          <button class="pixel-button" type="button" data-rate="useful">USEFUL</button>
          <button class="pixel-button" type="button" data-rate="useless">USELESS</button>
        </div>
        <p class="rate-verdict" data-verdict aria-live="polite" hidden></p>
        <div class="screen-next" data-next-row="0" hidden><button class="pixel-button next-button" type="button" data-next>MOVE 1: GIVE IT A ROLE →</button></div>
      </section>

      <section class="dojo-screen" data-screen="1" aria-label="Move 1: give it a role" hidden>
        <p class="screen-lede">Pick who Riverbot should be. Watch the prompt up top — your pick prepends a single sentence.</p>
        <div class="choice-row" role="group" aria-label="Roles">
          ${ROLES.map((role, index) => `<button class="pixel-button choice-chip" type="button" data-role="${index}">${escapeHtml(role.chip)}</button>`).join("\n          ")}
        </div>
        <div class="riverbot-answer" data-answer="1" aria-live="polite"></div>
        <div class="screen-next" data-next-row="1" hidden><button class="pixel-button next-button" type="button" data-next>MOVE 2: GIVE IT CONSTRAINTS →</button></div>
      </section>

      <section class="dojo-screen" data-screen="2" aria-label="Move 2: give it constraints" hidden>
        <p class="screen-lede">Now tell it what's actually true about your trip. Two facts, two sliders.</p>
        <div class="slider-row">
          <label class="demo-slider"><span class="slider-name pixel-small">group size</span><input type="range" min="0" max="2" step="1" value="0" data-dojo-slider="group" aria-valuetext="${GROUP_SIZES[0]}"><span class="slider-value" data-dojo-slider-value="group">${GROUP_SIZES[0]}</span></label>
          <label class="demo-slider"><span class="slider-name pixel-small">fear level</span><input type="range" min="0" max="2" step="1" value="0" data-dojo-slider="fear" aria-valuetext="${FEAR_LEVELS[0]}"><span class="slider-value" data-dojo-slider-value="fear">${FEAR_LEVELS[0]}</span></label>
        </div>
        <div class="riverbot-answer" data-answer="2" aria-live="polite"></div>
        <div class="screen-next" data-next-row="2" hidden><button class="pixel-button next-button" type="button" data-next>MOVE 3: SHOW AN EXAMPLE →</button></div>
      </section>

      <section class="dojo-screen" data-screen="3" aria-label="Move 3: show an example" hidden>
        <p class="screen-lede">Last move: show it the shape you want back. Don't describe the format — paste an example of it.</p>
        <div class="choice-row" role="group" aria-label="Example formats">
          ${FORMATS.map((format, index) => `<button class="pixel-button choice-chip" type="button" data-format="${index}">${escapeHtml(format.label)}</button>`).join("\n          ")}
        </div>
        <div class="riverbot-answer" data-answer="3" aria-live="polite"></div>
        <div class="screen-next" data-next-row="3" hidden><button class="pixel-button next-button" type="button" data-next>LEVEL UP →</button></div>
      </section>

      <section class="dojo-screen" data-screen="4" aria-label="Level up" hidden>
        <div class="levelup-stage">
          <span class="cairn cairn-bg" data-dojo-cairn style="background-image:url(/assets/sprites/cairn-3.png)"></span>
          <p class="levelup-title pixel-heading" data-levelup-title>${escapeHtml(LEVEL_UP.title)}</p>
        </div>
        <ul class="recap" role="list">
          ${LEVEL_UP.recap.map((item) => `<li><strong class="pixel-small">${escapeHtml(item.move)}</strong><p>${escapeHtml(item.plain)}</p></li>`).join("\n          ")}
        </ul>
        <div class="endpoint-row cheat-row"><code class="endpoint">${escapeHtml(LEVEL_UP.cheatLine)}</code><button class="pixel-button" type="button" data-copy-cheat>copy</button></div>
        <p class="honest-line">${escapeHtml(LEVEL_UP.honest)}</p>
        <nav class="now-buttons" aria-label="Where next">
          ${LEVEL_UP.buttons.map((button) => `<a class="pixel-button" href="${button.href}">${escapeHtml(button.label)}</a>`).join("\n          ")}
        </nav>
      </section>

      <noscript><p class="screen-lede">The dojo is an interactive exercise and needs JavaScript — everything it teaches is also in <a href="/notes/riding-instructors">the essay</a>.</p></noscript>
    </div>
  </div>
</main>`;
}
