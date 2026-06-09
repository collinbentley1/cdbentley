/** Live demos for the /work pages. All payloads are canned; no external calls. */

import { WORK_PAGES, type AvaDemo, type HistoryDemo, type MedlockDemo } from "../../content/work.ts";
import { reducedMotion, wireCopy } from "./shared.ts";


const medlockRoot = document.querySelector<HTMLElement>('[data-demo="medlock"]');
if (medlockRoot) {
  initMedlock(medlockRoot);
}

const avaRoot = document.querySelector<HTMLElement>('[data-demo="ava"]');
if (avaRoot) {
  initAva(avaRoot);
}

const otseekRoot = document.querySelector<HTMLElement>('[data-demo="otseek"]');
if (otseekRoot) {
  initOtseek(otseekRoot);
}

const runsettaRoot = document.querySelector<HTMLElement>('[data-demo="runsetta"]');
if (runsettaRoot) {
  initRunsetta(runsettaRoot);
}

const historyRoot = document.querySelector<HTMLElement>('[data-demo="critical-history"]');
if (historyRoot) {
  initHistory(historyRoot);
}

// ---------------------------------------------------------------- medlock ---

function initMedlock(root: HTMLElement): void {
  const demo = WORK_PAGES.find((page) => page.slug === "medlock")?.demo as MedlockDemo | undefined;
  if (!demo) {
    return;
  }
  const requestPane = root.querySelector<HTMLElement>('[data-pane="request"]');
  const responsePane = root.querySelector<HTMLElement>('[data-pane="response"]');

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
    button.addEventListener("click", () => {
      const tool = demo.tools[Number(button.dataset.tool ?? 0)];
      if (!tool || !requestPane || !responsePane) {
        return;
      }
      typePre(requestPane, tool.request, () => {
        window.setTimeout(() => typePre(responsePane, tool.response), 120);
      });
      responsePane.textContent = "";
    });
  }

  const copyButton = root.querySelector("[data-copy-endpoint]");
  if (copyButton) {
    wireCopy(copyButton, () => demo.endpoint);
  }
}

function typePre(element: HTMLElement, text: string, done?: () => void): void {
  if (reducedMotion.matches) {
    element.textContent = text;
    done?.();
    return;
  }
  element.textContent = "";
  let cursor = 0;
  // Scale the step so even long captured payloads finish in about a second.
  const step = Math.max(14, Math.ceil(text.length / 70));
  const timer = window.setInterval(() => {
    cursor += step;
    element.textContent = text.slice(0, cursor);
    if (cursor >= text.length) {
      window.clearInterval(timer);
      done?.();
    }
  }, 16);
}

// -------------------------------------------------------------------- ava ---

function initAva(root: HTMLElement): void {
  const data = root.querySelector('[data-ava-turns]')?.textContent;
  if (!data) {
    return;
  }
  const turns = JSON.parse(data) as AvaDemo["turns"];
  const chat = root.querySelector<HTMLElement>("[data-chat]");
  const playButton = root.querySelector<HTMLButtonElement>("[data-play]");
  const skipButton = root.querySelector<HTMLButtonElement>("[data-skip]");
  const doBox = root.querySelector<HTMLElement>(".do-box");
  const doWriter = root.querySelector<HTMLElement>("[data-do-writer]");
  if (!chat || !playButton) {
    return;
  }

  let skip = false;
  let running = false;

  playButton.addEventListener("click", () => {
    if (running) {
      return;
    }
    running = true;
    skip = false;
    chat.replaceChildren();
    for (const step of root.querySelectorAll(".tool-step")) {
      step.classList.remove("fired");
    }
    playButton.disabled = true;
    if (skipButton) {
      skipButton.hidden = false;
    }
    void playTurns();
  });

  skipButton?.addEventListener("click", () => {
    skip = true;
  });

  async function playTurns(): Promise<void> {
    for (const [index, turn] of turns.entries()) {
      await addMessage("chat-user", turn.user);
      const step = root.querySelector(`[data-step="${index}"]`);
      step?.classList.add("fired");
      await addToolCall(turn.tool.name);
      if (turn.durableObjectWrite && doBox && doWriter) {
        doBox.classList.add("writing");
        doWriter.textContent = "one writer · serialized";
      }
      await addMessage("chat-assistant", turn.assistant);
      if (turn.durableObjectWrite && doBox && doWriter) {
        window.setTimeout(() => {
          doBox.classList.remove("writing");
          doWriter.textContent = "write committed · idempotent";
        }, 900);
      }
    }
    running = false;
    if (playButton) {
      playButton.disabled = false;
      playButton.textContent = "↺ play it again";
    }
    if (skipButton) {
      skipButton.hidden = true;
    }
  }

  function addToolCall(name: string): Promise<void> {
    const line = document.createElement("p");
    line.className = "chat-toolcall";
    line.textContent = `⚙ tools/call → ${name}`;
    chat?.append(line);
    return pause(skip ? 0 : 420);
  }

  function addMessage(className: string, text: string): Promise<void> {
    const bubble = document.createElement("div");
    bubble.className = `chat-msg ${className}`;
    chat?.append(bubble);
    bubble.scrollIntoView({ behavior: "auto", block: "nearest" });
    if (skip || reducedMotion.matches) {
      bubble.textContent = text;
      return pause(skip ? 30 : 250);
    }
    return new Promise((resolve) => {
      let cursor = 0;
      const timer = window.setInterval(() => {
        cursor += 1;
        bubble.textContent = text.slice(0, cursor);
        if (skip || cursor >= text.length) {
          bubble.textContent = text;
          window.clearInterval(timer);
          window.setTimeout(resolve, 260);
        }
      }, 33);
    });
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

// ----------------------------------------------------------------- otseek ---

function initOtseek(root: HTMLElement): void {
  const runButton = root.querySelector<HTMLButtonElement>("[data-run]");
  const lanes = [...root.querySelectorAll<HTMLElement>(".lane")];
  const merge = root.querySelector<HTMLElement>("[data-merge]");
  if (!runButton) {
    return;
  }

  runButton.addEventListener("click", () => {
    runButton.disabled = true;
    for (const lane of lanes) {
      lane.classList.remove("up", "committing");
    }
    merge?.classList.remove("merged");

    lanes.forEach((lane, index) => {
      window.setTimeout(
        () => {
          lane.classList.add("up");
        },
        reducedMotion.matches ? 0 : 220 * index,
      );
      window.setTimeout(
        () => {
          lane.classList.add("committing");
          // Fly the commit dot via transform only (§4: no layout animation).
          const commit = lane.querySelector<HTMLElement>("[data-commit]");
          const track = lane.querySelector<HTMLElement>(".lane-track");
          if (commit && track) {
            commit.style.transition = "none";
            commit.style.transform = `translateX(${-(track.clientWidth - 14)}px)`;
            void commit.offsetWidth;
            commit.style.transition = reducedMotion.matches ? "none" : "transform 700ms steps(7)";
            commit.style.transform = "translateX(0)";
          }
        },
        reducedMotion.matches ? 0 : 220 * lanes.length + 320 * index,
      );
    });
    window.setTimeout(
      () => {
        merge?.classList.add("merged");
        runButton.disabled = false;
        runButton.textContent = "↺ run it again";
      },
      reducedMotion.matches ? 60 : 220 * lanes.length + 320 * lanes.length + 500,
    );
  });
}

// --------------------------------------------------------------- runsetta ---

function initRunsetta(root: HTMLElement): void {
  const data = root.querySelector("[data-coach-lines]")?.textContent;
  if (!data) {
    return;
  }
  const lines = JSON.parse(data) as string[][][];
  const bubble = root.querySelector<HTMLElement>("[data-coach-line]");
  const sayButton = root.querySelector<HTMLButtonElement>("[data-say]");
  const indexes: Record<string, number> = { mood: 0, pace: 0, weather: 0 };

  function currentLine(): string {
    return lines[indexes.pace ?? 0]?.[indexes.mood ?? 0]?.[indexes.weather ?? 0] ?? "";
  }

  function update(): void {
    if (bubble) {
      bubble.textContent = currentLine();
    }
  }

  for (const slider of root.querySelectorAll<HTMLInputElement>("[data-slider]")) {
    const name = slider.dataset.slider ?? "";
    const label = root.querySelector<HTMLElement>(`[data-slider-value="${name}"]`);
    const values = name === "pace" ? ["easy", "tempo", "race"] : name === "weather" ? ["rain", "heat", "perfect"] : ["hype", "zen", "drill-sergeant"];
    slider.addEventListener("input", () => {
      indexes[name] = Number(slider.value);
      const value = values[Number(slider.value)] ?? "";
      slider.setAttribute("aria-valuetext", value);
      if (label) {
        label.textContent = value;
      }
      update();
    });
  }

  let player: HTMLAudioElement | null = null;
  sayButton?.addEventListener("click", () => {
    const line = currentLine();
    if (!line) {
      return;
    }
    // Pre-rendered recording (no live API); browser speech only if the file fails.
    player?.pause();
    player = new Audio(`/assets/audio/coach/coach-${indexes.pace ?? 0}-${indexes.mood ?? 0}-${indexes.weather ?? 0}.m4a`);
    player.play().catch(() => {
      if (!("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    });
  });

  update();
}

// ---------------------------------------------------- critical-history ---

function initHistory(root: HTMLElement): void {
  const data = root.querySelector("[data-history-entries]")?.textContent;
  if (!data) {
    return;
  }
  const entries = JSON.parse(data) as HistoryDemo["entries"];
  const viewport = root.querySelector<HTMLElement>("[data-viewport]");
  const note = root.querySelector<HTMLElement>("[data-map-note]");
  const flyButton = root.querySelector<HTMLButtonElement>("[data-fly]");
  const pins = [...root.querySelectorAll<HTMLElement>(".map-pin")];

  const map = root.querySelector<HTMLElement>("[data-map]");

  function visit(index: number): void {
    const entry = entries[index];
    if (!entry || !viewport || !map) {
      return;
    }
    viewport.classList.add("flying");
    // Fly via transform only (§4): convert the entry's % position to pixels.
    const x = (map.clientWidth * entry.x) / 100;
    const y = (map.clientHeight * entry.y) / 100;
    viewport.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
    pins.forEach((pin, pinIndex) => pin.classList.toggle("visited", pinIndex <= index));
    if (note) {
      note.textContent = `${entry.label} — ${entry.note}`;
    }
  }

  pins.forEach((pin, index) => {
    pin.addEventListener("click", () => visit(index));
  });

  flyButton?.addEventListener("click", () => {
    flyButton.disabled = true;
    const stepMs = reducedMotion.matches ? 60 : 1300;
    entries.forEach((_, index) => {
      window.setTimeout(() => visit(index), stepMs * index + 100);
    });
    window.setTimeout(() => {
      flyButton.disabled = false;
      flyButton.textContent = "↺ fly it again";
    }, stepMs * entries.length + 200);
  });
}
