/**
 * The Dojo v2 — "FIND THE FLAW". Fully scripted; no model is called and no
 * score leaves the tab. Ten confident answers, one planted flaw each: the
 * visitor clicks the sentence they distrust, the verdict names the failure
 * mode, and the end screen reports a real capability read — accuracy, speed
 * per catch, category breakdown, and improvement across runs.
 */

import { END, ITEMS, PREMISE, VERDICT, type DojoItem } from "../../content/dojo.ts";
import { reducedMotion } from "./shared.ts";

const root = document.querySelector<HTMLElement>("[data-dojo]");

if (root) {
  initDojo(root);
}

type Result = {
  item: DojoItem;
  correct: boolean;
  ms: number;
};

function initDojo(dojo: HTMLElement): void {
  const screens = {
    end: dojo.querySelector<HTMLElement>('[data-screen="end"]'),
    intro: dojo.querySelector<HTMLElement>('[data-screen="intro"]'),
    play: dojo.querySelector<HTMLElement>('[data-screen="play"]'),
  };
  const answerBox = dojo.querySelector<HTMLElement>("[data-answer-box]");
  const verdictBox = dojo.querySelector<HTMLElement>("[data-verdict-box]");
  const verdictLine = dojo.querySelector<HTMLElement>("[data-verdict-line]");
  const verdictCategory = dojo.querySelector<HTMLElement>("[data-verdict-category]");
  const verdictExplanation = dojo.querySelector<HTMLElement>("[data-verdict-explanation]");
  const itemCounter = dojo.querySelector<HTMLElement>("[data-item-counter]");
  const difficultyChip = dojo.querySelector<HTMLElement>("[data-difficulty]");
  const dots = [...dojo.querySelectorAll<HTMLElement>("[data-dot]")];
  const senseiBubble = document.getElementById("sensei-bubble");

  let order = ITEMS.map((_, index) => index);
  let position = 0;
  let shownAt = 0;
  let results: Result[] = [];
  let lastRunScore: number | null = null;
  let runSeed = 1;

  function speak(line: string): void {
    if (!(senseiBubble instanceof HTMLElement)) {
      return;
    }
    senseiBubble.textContent = line;
    senseiBubble.classList.remove("show");
    void senseiBubble.offsetWidth;
    senseiBubble.classList.add("show");
    senseiBubble.setAttribute("aria-hidden", "false");
  }

  function show(name: keyof typeof screens): void {
    for (const [key, screen] of Object.entries(screens)) {
      if (screen) {
        screen.hidden = key !== name;
        screen.classList.toggle("screen-active", key === name);
      }
    }
  }

  // --- play ------------------------------------------------------------------

  function renderItem(): void {
    const item = ITEMS[order[position] ?? 0];
    if (!item || !answerBox) {
      return;
    }
    if (itemCounter) {
      itemCounter.textContent = `ITEM ${position + 1} / ${ITEMS.length}`;
    }
    if (difficultyChip) {
      difficultyChip.textContent = item.difficulty;
      difficultyChip.dataset.level = item.difficulty;
    }
    dots.forEach((dot, index) => {
      dot.classList.toggle("dot-current", index === position);
    });

    answerBox.replaceChildren();
    delete answerBox.dataset.locked;
    if (verdictBox) {
      verdictBox.hidden = true;
    }

    item.sentences.forEach((sentence, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flaw-sentence";
      button.textContent = sentence;
      button.dataset.sentence = String(index);
      button.addEventListener("click", () => choose(item, index, button));
      answerBox.append(button);
      answerBox.append(document.createTextNode(" "));
    });

    if (item.code) {
      const pre = document.createElement("pre");
      pre.className = "flaw-code";
      pre.textContent = item.code;
      answerBox.append(pre);
    }

    shownAt = performance.now();
    answerBox.querySelector<HTMLElement>(".flaw-sentence")?.focus({ preventScroll: true });
  }

  function choose(item: DojoItem, chosen: number, button: HTMLButtonElement): void {
    if (!answerBox || answerBox.dataset.locked === "1") {
      return;
    }
    answerBox.dataset.locked = "1";
    const correct = chosen === item.flawIndex;
    results.push({ correct, item, ms: performance.now() - shownAt });

    const sentences = [...answerBox.querySelectorAll<HTMLButtonElement>(".flaw-sentence")];
    for (const sentence of sentences) {
      sentence.disabled = true;
    }
    button.classList.add(correct ? "chosen-right" : "chosen-wrong");
    if (!correct) {
      sentences[item.flawIndex]?.classList.add("the-flaw");
    }

    const dot = dots[position];
    if (dot) {
      dot.classList.add(correct ? "dot-hit" : "dot-miss");
    }

    if (verdictBox && verdictLine && verdictCategory && verdictExplanation) {
      verdictLine.textContent = correct ? "Caught it." : "It slipped past.";
      verdictLine.dataset.state = correct ? "right" : "wrong";
      verdictCategory.textContent = `FAILURE MODE: ${item.category.toUpperCase()}`;
      verdictExplanation.textContent = item.explanation;
      verdictBox.hidden = false;
      verdictBox.querySelector<HTMLElement>("[data-next-item]")?.focus({ preventScroll: true });
    }

    speak(correct ? VERDICT.correct.replace("{category}", item.category) : VERDICT.wrong.replace("{n}", String(item.flawIndex + 1)).replace("{category}", item.category));
  }

  function next(): void {
    if (answerBox) {
      delete answerBox.dataset.locked;
    }
    position += 1;
    if (position >= order.length) {
      finish();
      return;
    }
    renderItem();
  }

  // --- end -------------------------------------------------------------------

  function finish(): void {
    show("end");
    const caught = results.filter((result) => result.correct).length;

    const closing = dojo.querySelector<HTMLElement>("[data-end-closing]");
    if (closing) {
      closing.textContent = END.closing.replace("{n}", String(caught));
    }

    const half = Math.ceil(results.length / 2);
    const round1 = results.slice(0, half);
    const round2 = results.slice(half);
    const rounds = dojo.querySelector<HTMLElement>("[data-end-rounds]");
    if (rounds) {
      rounds.textContent = `Round 1 (easy–medium): ${round1.filter((r) => r.correct).length}/${round1.length} · Round 2 (medium–hard): ${round2.filter((r) => r.correct).length}/${round2.length}. ${END.roundNote}`;
    }

    const speed = dojo.querySelector<HTMLElement>("[data-end-speed]");
    if (speed) {
      const times = results.map((result) => result.ms).sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)] ?? 0;
      const fastestCatch = results.filter((r) => r.correct).sort((a, b) => a.ms - b.ms)[0];
      speed.textContent = `Median read-to-verdict: ${(median / 1000).toFixed(1)}s.` + (fastestCatch ? ` Fastest catch: ${(fastestCatch.ms / 1000).toFixed(1)}s (${fastestCatch.item.category}).` : "");
    }

    const categories = dojo.querySelector<HTMLElement>("[data-end-categories]");
    if (categories) {
      const missed = results.filter((result) => !result.correct).map((result) => result.item.category);
      categories.textContent = missed.length === 0 ? END.perfectNote : `${END.slippedLabel} ${missed.join(", ")}.`;
    }

    const delta = dojo.querySelector<HTMLElement>("[data-end-delta]");
    if (delta) {
      if (lastRunScore !== null) {
        delta.hidden = false;
        const trend = caught > lastRunScore ? "harder to fool than last run" : caught === lastRunScore ? "holding steady" : "the flaws shuffled — stay suspicious";
        delta.textContent = `last run ${lastRunScore}/10 → this run ${caught}/10 — ${trend}`;
      } else {
        delta.hidden = true;
      }
    }
    lastRunScore = caught;

    dropEndCairn();
  }

  function dropEndCairn(): void {
    const cairn = dojo.querySelector<HTMLElement>("[data-dojo-cairn]");
    if (!cairn) {
      return;
    }
    if (reducedMotion.matches) {
      cairn.style.backgroundImage = "url(/assets/sprites/cairn-4.png)";
      return;
    }
    const width = cairn.clientWidth || 84;
    const height = cairn.clientHeight || 90;
    cairn.style.backgroundImage = "url(/assets/sprites/cairn-drop-3.png)";
    cairn.style.backgroundSize = `${width * 3}px ${height}px`;
    for (const frame of [0, 1, 2]) {
      window.setTimeout(() => {
        cairn.style.backgroundPosition = `${-frame * width}px 0`;
      }, 90 + frame * 50);
    }
    window.setTimeout(() => {
      cairn.style.backgroundImage = "url(/assets/sprites/cairn-4.png)";
      cairn.style.backgroundSize = "100% 100%";
      cairn.style.backgroundPosition = "0 0";
    }, 90 + 3 * 50);
  }

  // --- wiring ------------------------------------------------------------------

  dojo.querySelector("[data-start]")?.addEventListener("click", () => {
    show("play");
    position = 0;
    results = [];
    renderItem();
  });

  dojo.querySelector("[data-next-item]")?.addEventListener("click", next);

  dojo.querySelector("[data-replay]")?.addEventListener("click", () => {
    // Deterministic reshuffle per run; difficulty still ramps within each half.
    runSeed += 1;
    const easyMedium = ITEMS.map((_, index) => index).filter((index) => ITEMS[index]?.difficulty !== "hard");
    const hard = ITEMS.map((_, index) => index).filter((index) => ITEMS[index]?.difficulty === "hard");
    order = [...rotate(easyMedium, runSeed), ...rotate(hard, runSeed)];
    position = 0;
    results = [];
    dots.forEach((dot) => dot.classList.remove("dot-hit", "dot-miss", "dot-current"));
    const cairn = dojo.querySelector<HTMLElement>("[data-dojo-cairn]");
    if (cairn) {
      cairn.style.backgroundImage = "url(/assets/sprites/cairn-3.png)";
      cairn.style.backgroundSize = "100% 100%";
    }
    show("play");
    renderItem();
  });

  speak(PREMISE.senseiIntro);
}

function rotate<T>(values: T[], by: number): T[] {
  const shift = by % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}
