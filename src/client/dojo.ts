/**
 * The Dojo (§5.4) — fully scripted teaching loop. No API is ever called;
 * every Riverbot answer ships canned in content/dojo.ts.
 */

import { BASE_PROMPT, CONSTRAINT_ANSWERS, CONSTRAINT_SENSEI, FEAR_LEVELS, FORMATS, FORMAT_SENSEI, GROUP_SIZES, LEVEL_UP, RATE_RESPONSE, ROLES, ROLE_SENSEI, USELESS_ANSWER } from "../../content/dojo.ts";
import { wireCopy } from "./shared.ts";

const root = document.querySelector<HTMLElement>("[data-dojo]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (root) {
  initDojo(root);
}

function initDojo(root: HTMLElement): void {
  const screens = [...root.querySelectorAll<HTMLElement>(".dojo-screen")];
  const markers = [...root.querySelectorAll<HTMLElement>("[data-step-marker]")];
  const promptText = root.querySelector<HTMLElement>("[data-prompt-text]");
  const senseiBubble = document.getElementById("sensei-bubble");

  let roleIndex = 0;
  let groupIndex = 0;
  let fearIndex = 0;

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

  function setPrompt(parts: Array<{ text: string; fresh?: boolean }>): void {
    if (!promptText) {
      return;
    }
    promptText.replaceChildren(
      ...parts.flatMap((part, index) => {
        const span = document.createElement("span");
        span.className = part.fresh ? "prompt-add" : "prompt-base";
        span.textContent = part.text;
        return index > 0 ? [document.createTextNode(" "), span] : [span];
      }),
    );
  }

  function promptParts(stage: number): Array<{ text: string; fresh?: boolean }> {
    const parts: Array<{ text: string; fresh?: boolean }> = [];
    if (stage >= 1) {
      parts.push({ fresh: stage === 1, text: ROLES[roleIndex]?.prefix ?? "" });
    }
    parts.push({ text: BASE_PROMPT + (stage >= 2 ? "." : "") });
    if (stage >= 2) {
      parts.push({ fresh: stage === 2, text: `We are ${GROUP_SIZES[groupIndex]} people; fear level: ${FEAR_LEVELS[fearIndex]}.` });
    }
    if (stage >= 3) {
      parts.push({ fresh: true, text: FORMATS[formatIndex]?.example ?? "" });
    }
    return parts;
  }

  function show(index: number): void {
    screens.forEach((screen, screenIndex) => {
      screen.hidden = screenIndex !== index;
      screen.classList.toggle("screen-active", screenIndex === index);
    });
    markers.forEach((marker, markerIndex) => {
      marker.classList.toggle("step-active", markerIndex === index);
      marker.classList.toggle("step-done", markerIndex < index);
    });
    const active = screens[index];
    const focusable = active?.querySelector<HTMLElement>("button, a, input");
    focusable?.focus({ preventScroll: false });
  }

  function typeInto(element: HTMLElement, text: string, done?: () => void): void {
    if (reducedMotion.matches) {
      element.textContent = text;
      done?.();
      return;
    }
    element.textContent = "";
    let cursor = 0;
    const timer = window.setInterval(() => {
      cursor += 2;
      element.textContent = text.slice(0, cursor);
      if (cursor >= text.length) {
        window.clearInterval(timer);
        done?.();
      }
    }, 24);
  }

  // --- Screen 0: TRY -----------------------------------------------------------
  const answer0 = root.querySelector<HTMLElement>('[data-answer="0"]');
  const rateRow = root.querySelector<HTMLElement>("[data-rate-row]");
  const verdict = root.querySelector<HTMLElement>("[data-verdict]");

  if (answer0) {
    typeInto(answer0, USELESS_ANSWER, () => {
      if (rateRow) {
        rateRow.hidden = false;
      }
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-rate]")) {
    button.addEventListener("click", () => {
      if (verdict) {
        verdict.hidden = false;
        verdict.textContent = RATE_RESPONSE;
      }
      speak(RATE_RESPONSE);
      showNextRow(0);
    });
  }

  // --- Screen 1: ROLE -----------------------------------------------------------
  const answer1 = root.querySelector<HTMLElement>('[data-answer="1"]');
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-role]")) {
    button.addEventListener("click", () => {
      roleIndex = Number(button.dataset.role ?? 0);
      pressOnly(root.querySelectorAll<HTMLButtonElement>("[data-role]"), button);
      setPrompt(promptParts(1));
      if (answer1) {
        typeInto(answer1, ROLES[roleIndex]?.answer ?? "", () => {
          speak(ROLE_SENSEI);
          showNextRow(1);
        });
      }
    });
  }

  // --- Screen 2: CONSTRAINTS -------------------------------------------------------
  const answer2 = root.querySelector<HTMLElement>('[data-answer="2"]');
  let constraintTouched = false;

  function updateConstraints(): void {
    setPrompt(promptParts(2));
    const line = CONSTRAINT_ANSWERS[groupIndex]?.[fearIndex] ?? "";
    if (answer2) {
      answer2.textContent = line;
    }
    if (!constraintTouched) {
      constraintTouched = true;
      speak(CONSTRAINT_SENSEI);
      showNextRow(2);
    }
  }

  for (const slider of root.querySelectorAll<HTMLInputElement>("[data-dojo-slider]")) {
    const name = slider.dataset.dojoSlider;
    const valueLabel = root.querySelector<HTMLElement>(`[data-dojo-slider-value="${name}"]`);
    slider.addEventListener("input", () => {
      const index = Number(slider.value);
      const values = name === "group" ? GROUP_SIZES : FEAR_LEVELS;
      if (name === "group") {
        groupIndex = index;
      } else {
        fearIndex = index;
      }
      const label = values[index] ?? "";
      slider.setAttribute("aria-valuetext", label);
      if (valueLabel) {
        valueLabel.textContent = label;
      }
      updateConstraints();
    });
  }

  // --- Screen 3: EXAMPLE -------------------------------------------------------------
  let formatIndex = 0;
  const answer3 = root.querySelector<HTMLElement>('[data-answer="3"]');
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-format]")) {
    button.addEventListener("click", () => {
      formatIndex = Number(button.dataset.format ?? 0);
      pressOnly(root.querySelectorAll<HTMLButtonElement>("[data-format]"), button);
      setPrompt(promptParts(3));
      if (answer3) {
        renderFormatted(answer3, formatIndex);
        speak(FORMAT_SENSEI);
        showNextRow(3);
      }
    });
  }

  function renderFormatted(element: HTMLElement, index: number): void {
    const format = FORMATS[index];
    if (!format) {
      return;
    }
    element.replaceChildren();
    const intro = document.createElement("p");
    intro.textContent = format.answer.intro;
    intro.style.marginTop = "0";
    element.append(intro);
    if ("rows" in format.answer) {
      const table = document.createElement("table");
      for (const [time, item] of format.answer.rows) {
        const row = table.insertRow();
        row.insertCell().textContent = time ?? "";
        row.insertCell().textContent = item ?? "";
      }
      element.append(table);
    } else {
      const list = document.createElement("ul");
      for (const item of format.answer.checklist) {
        const li = document.createElement("li");
        li.textContent = item;
        list.append(li);
      }
      element.append(list);
      const outro = document.createElement("p");
      outro.textContent = format.answer.outro;
      element.append(outro);
    }
  }

  // --- Screen 4: LEVEL UP ----------------------------------------------------------------
  const cheatButton = root.querySelector("[data-copy-cheat]");
  if (cheatButton) {
    wireCopy(cheatButton, () => LEVEL_UP.cheatLine);
  }

  // --- navigation -------------------------------------------------------------------------
  function showNextRow(index: number): void {
    const row = root.querySelector<HTMLElement>(`[data-next-row="${index}"]`);
    if (row) {
      row.hidden = false;
    }
  }

  let screenIndex = 0;
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-next]")) {
    button.addEventListener("click", () => {
      screenIndex += 1;
      show(screenIndex);
      if (screenIndex === 1) {
        speak("Pick a role. Any of them.");
      }
      if (screenIndex === 2) {
        setPrompt(promptParts(1));
      }
      if (screenIndex === 4) {
        levelUp();
      }
    });
  }

  function levelUp(): void {
    speak(LEVEL_UP.title);
    const cairn = root.querySelector<HTMLElement>("[data-dojo-cairn]");
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

  show(0);
  setPrompt([{ text: BASE_PROMPT }]);
}

function pressOnly(buttons: Iterable<HTMLButtonElement>, active: HTMLButtonElement): void {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", button === active ? "true" : "false");
  }
}
