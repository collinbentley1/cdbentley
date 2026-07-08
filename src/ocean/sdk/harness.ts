/**
 * Standalone dummy-renderer harness. A scene agent's entire harness entry is:
 *
 *   import { runHarness } from "../../sdk/index.ts";
 *   import { scene } from "./scene.ts";
 *   runHarness(scene);
 *
 * plus a copy of public/ocean/harness/demo.html renamed to <sceneId>.html
 * with the script src pointed at /assets/ocean/harness/<sceneId>.js.
 * The dev server serves it at /ocean/harness/<sceneId>.html.
 *
 * Controls: depth slider (drive compaction both directions), pause/step,
 * fps + cpu readout, dirty-cell readout, live resolution state, and the
 * scene's tunable motion constants as number inputs.
 */

import { assertSceneContract } from "./assert.ts";
import { createGlyphRenderer } from "./renderer.ts";
import { createSceneRunner } from "./runner.ts";
import { OCEAN_THEME } from "./theme.ts";
import type { SceneModule } from "./types.ts";

export interface HarnessOptions {
  root?: HTMLElement;
}

export function runHarness(scene: SceneModule, options: HarnessOptions = {}): void {
  const root = options.root ?? document.body;
  root.style.margin = "0";
  root.style.background = OCEAN_THEME.background;
  root.style.color = OCEAN_THEME.ink;
  root.style.fontFamily = OCEAN_THEME.fontFamily;
  root.style.fontSize = "12px";

  try {
    assertSceneContract(scene);
  } catch (error) {
    const message = document.createElement("pre");
    message.textContent = `scene contract violation\n\n${error instanceof Error ? error.message : String(error)}`;
    message.style.padding = "16px";
    message.style.whiteSpace = "pre-wrap";
    root.append(message);
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "8px";
  wrap.style.padding = "12px";

  const title = document.createElement("div");
  title.textContent = `harness: ${scene.id}`;
  wrap.append(title);

  const canvas = document.createElement("canvas");
  canvas.style.maxWidth = "100%";
  wrap.append(canvas);

  const readout = document.createElement("div");
  readout.style.whiteSpace = "pre";
  wrap.append(readout);

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "12px";
  controls.style.alignItems = "center";
  controls.style.flexWrap = "wrap";
  wrap.append(controls);

  const renderer = createGlyphRenderer(canvas, {
    cellH: scene.tuning.cellH ?? 8,
    cellW: scene.tuning.cellW ?? 8,
    cols: scene.tuning.cols,
    rows: scene.tuning.rows,
  });

  let cpuAccum = 0;
  let frameAccum = 0;
  let frames = 0;
  let fpsText = "fps -- cpu --ms";

  const runner = createSceneRunner(scene, renderer, {
    onFrame({ cpuMs, dt, resolution }) {
      cpuAccum += cpuMs;
      frameAccum += dt;
      frames++;

      if (frameAccum >= 0.5 && frames > 0) {
        fpsText = `fps ${(frames / frameAccum).toFixed(1)} cpu ${(cpuAccum / frames).toFixed(2)}ms`;
        cpuAccum = 0;
        frameAccum = 0;
        frames = 0;
      }

      const stats = renderer.stats();
      readout.textContent =
        `${fpsText}  dirty ${stats.dirtyCells}/${stats.totalCells}\n` +
        `depth ${runner.context.depth.toFixed(2)}  bin ${resolution.bin}  rampLevel ${resolution.rampLevel}  ` +
        `detail ${resolution.detail.toFixed(2)}  collapse ${resolution.collapse.toFixed(2)}`;
    },
  });

  const depthLabel = document.createElement("label");
  depthLabel.textContent = "depth ";
  const depth = document.createElement("input");
  depth.type = "range";
  depth.min = "-0.5";
  depth.max = "2.5";
  depth.step = "0.01";
  depth.value = "0";
  depth.style.width = "260px";
  depth.addEventListener("input", () => {
    runner.setDepth(Number(depth.value));
  });
  depthLabel.append(depth);
  controls.append(depthLabel);

  const pause = document.createElement("button");
  pause.textContent = "pause";
  stylePlainButton(pause);
  pause.addEventListener("click", () => {
    if (runner.running) {
      runner.stop();
      pause.textContent = "resume";
    } else {
      runner.start();
      pause.textContent = "pause";
    }
  });
  controls.append(pause);

  const step = document.createElement("button");
  step.textContent = "step";
  stylePlainButton(step);
  step.addEventListener("click", () => {
    if (!runner.running) {
      runner.step(1 / 60);
    }
  });
  controls.append(step);

  const tunables = document.createElement("div");
  tunables.style.display = "flex";
  tunables.style.gap = "10px";
  tunables.style.flexWrap = "wrap";

  for (const key of Object.keys(scene.tuning.motion)) {
    const label = document.createElement("label");
    label.textContent = `${key} `;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = String(scene.tuning.motion[key]);
    input.style.width = "80px";
    input.style.background = OCEAN_THEME.background;
    input.style.color = OCEAN_THEME.ink;
    input.style.border = `1px solid ${OCEAN_THEME.ink}`;
    input.style.fontFamily = "inherit";
    input.addEventListener("input", () => {
      const value = Number(input.value);

      if (Number.isFinite(value)) {
        scene.tuning.motion[key] = value;
      }
    });
    label.append(input);
    tunables.append(label);
  }

  wrap.append(tunables);

  const rampNote = document.createElement("div");
  rampNote.textContent = `ramp ${JSON.stringify(scene.tuning.ramp)}  grid ${scene.tuning.cols}x${scene.tuning.rows}`;
  wrap.append(rampNote);

  root.append(wrap);
  runner.start();
}

function stylePlainButton(button: HTMLButtonElement): void {
  button.style.background = OCEAN_THEME.background;
  button.style.color = OCEAN_THEME.ink;
  button.style.border = `1px solid ${OCEAN_THEME.ink}`;
  button.style.fontFamily = "inherit";
  button.style.padding = "2px 10px";
  button.style.cursor = "pointer";
}
