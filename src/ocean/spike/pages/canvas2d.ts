/**
 * Spike path (a): Canvas2D + pre-rasterized glyph atlas + dirty-cell updates
 * (the SDK's fallback renderer), driven by the shared water field.
 * Query: ?cols=200&rows=90&cell=8&churn=1&full=1
 */

import { createBuffer, createCanvas2dRenderer } from "../../sdk/index.ts";
import { installBench } from "../bench.ts";
import { CHURN_SPEED_MULTIPLIER, createWaterField, spikeParams, SPIKE_RAMP } from "../field.ts";

const { cell, churn, cols, full, rows } = spikeParams(location.search);
const canvas = document.createElement("canvas");
document.body.append(canvas);

const renderer = createCanvas2dRenderer(canvas, { cellH: cell, cellW: cell, cols, rows });
const buffer = createBuffer(cols, rows);
const field = createWaterField(3, churn ? CHURN_SPEED_MULTIPLIER : 1);

installBench(
  (_dt, time) => {
    field.write(buffer, time);

    if (full) {
      renderer.clear();
    }

    renderer.draw(buffer, SPIKE_RAMP);
  },
  () => {
    const stats = renderer.stats();
    return `canvas2d ${cols}x${rows} cell=${cell} dpr=${renderer.dpr} churn=${churn} full=${full} dirty=${stats.dirtyCells}/${stats.totalCells}`;
  },
);
