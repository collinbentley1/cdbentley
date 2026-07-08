/**
 * Spike path (b): WebGL2 fullscreen pass sampling a glyph-atlas texture from
 * a luminance texture; the fragment shader does the luminance -> ramp-glyph
 * mapping. This drives the SDK's production WebGL renderer
 * (src/ocean/sdk/renderer-webgl.ts) so the benchmark measures the code
 * scenes will actually run on. CPU per frame: shared water field sim +
 * byte conversion + one texSubImage2D + one draw call.
 * Query: ?cols=200&rows=90&cell=8&churn=1
 */

import { createBuffer, createWebglRenderer } from "../../sdk/index.ts";
import { installBench } from "../bench.ts";
import { CHURN_SPEED_MULTIPLIER, createWaterField, spikeParams, SPIKE_RAMP } from "../field.ts";

const { cell, churn, cols, rows } = spikeParams(location.search);
const canvas = document.createElement("canvas");
document.body.append(canvas);

const renderer = createWebglRenderer(canvas, { cellH: cell, cellW: cell, cols, rows });

if (!renderer) {
  document.body.textContent = "webgl2 unavailable";
  throw new Error("webgl2 unavailable");
}

const buffer = createBuffer(cols, rows);
const field = createWaterField(3, churn ? CHURN_SPEED_MULTIPLIER : 1);
const gpuName = describeGpu();

installBench(
  (_dt, time) => {
    field.write(buffer, time);
    renderer.draw(buffer, SPIKE_RAMP);
  },
  () => `webgl2 ${cols}x${rows} cell=${cell} dpr=${renderer.dpr} churn=${churn} gpu=${gpuName}`,
);

function describeGpu(): string {
  const probe = document.createElement("canvas").getContext("webgl2");

  if (!probe) {
    return "unknown";
  }

  const info = probe.getExtension("WEBGL_debug_renderer_info");
  return info ? String(probe.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(probe.getParameter(probe.RENDERER));
}
