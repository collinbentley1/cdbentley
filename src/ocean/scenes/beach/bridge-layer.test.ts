import { expect, test } from "bun:test";

import { assertBufferInRange, assertBufferShape, createBuffer } from "../../sdk/index.ts";
import { BRIDGE_GRID, bridgeCableRow, renderBridgeFrame } from "./bridge-layer.ts";

function frameAt(time: number) {
  const buffer = createBuffer(BRIDGE_GRID.cols, BRIDGE_GRID.rows);
  renderBridgeFrame(buffer, time);
  return buffer;
}

test("bridge frames are deterministic, shaped, and in luminance range", () => {
  const a = frameAt(4.25);
  const b = frameAt(4.25);

  assertBufferShape(a, BRIDGE_GRID.cols, BRIDGE_GRID.rows);
  assertBufferInRange(a);
  expect(Array.from(a.data)).toEqual(Array.from(b.data));
});

test("bridge architecture stays fixed while air and water move", () => {
  const a = frameAt(0);
  const b = frameAt(9);
  let changed = 0;

  for (let i = 0; i < a.data.length; i++) {
    if ((a.data[i] ?? 0) !== (b.data[i] ?? 0)) {
      changed++;
    }
  }

  expect(changed).toBeGreaterThan(100);

  const anchors = [
    [1, 26],
    [60, 26],
    [118, 26],
    [32, 5],
    [36, 28],
    [83, 5],
    [87, 28],
    [60, bridgeCableRow(60)],
  ] as const;

  for (const [x, y] of anchors) {
    const index = y * BRIDGE_GRID.cols + x;
    expect(a.data[index] ?? 0).toBeGreaterThanOrEqual(0.7);
    expect(b.data[index]).toBe(a.data[index]);
  }
});

test("main cable sags between fixed tower crowns", () => {
  expect(bridgeCableRow(34)).toBe(5);
  expect(bridgeCableRow(60)).toBeGreaterThan(bridgeCableRow(34) + 10);
  expect(bridgeCableRow(86)).toBe(5);
  expect(bridgeCableRow(0)).toBeGreaterThan(bridgeCableRow(34));
  expect(bridgeCableRow(BRIDGE_GRID.cols - 1)).toBeGreaterThan(bridgeCableRow(86));
});
