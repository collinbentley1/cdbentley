/**
 * WebGL2 implementation of GlyphRenderer — the Phase A spike winner.
 *
 * One fullscreen triangle; the fragment shader maps each output pixel to a
 * grid cell, fetches its luminance from an R8 texture, quantizes it to a
 * ramp index, and samples the pre-rasterized glyph-atlas texture. Per frame
 * the CPU does only the (binned) luminance byte conversion, one
 * texSubImage2D of at most cols x rows bytes, and one draw call — cost is
 * independent of how many cells changed, which is what wins during
 * compaction (ramp/bin swaps invalidate everything) and scroll churn.
 */

import { createGlyphAtlas } from "./atlas.ts";
import { binBuffer, createBuffer, type LuminanceBuffer } from "./buffer.ts";
import type { GlyphRenderer, GlyphRendererOptions } from "./renderer.ts";
import { OCEAN_THEME } from "./theme.ts";

const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 pos[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uLum;
uniform sampler2D uAtlas;
uniform vec2 uCellPx;
uniform ivec2 uGrid;
uniform float uRampLen;
uniform float uCanvasH;
out vec4 outColor;
void main() {
  vec2 frag = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y);
  ivec2 cell = clamp(ivec2(frag / uCellPx), ivec2(0), uGrid - 1);
  float v = texelFetch(uLum, cell, 0).r;
  float idx = min(floor(v * uRampLen), uRampLen - 1.0);
  vec2 inCell = clamp(fract(frag / uCellPx), 0.0, 1.0);
  vec2 uv = vec2((idx + inCell.x) / uRampLen, inCell.y);
  outColor = vec4(texture(uAtlas, uv).rgb, 1.0);
}
`;

interface LumPlane {
  texture: WebGLTexture;
  width: number;
  height: number;
  scratch: LuminanceBuffer | null;
  bytes: Uint8Array;
}

/** Returns null when WebGL2 is unavailable (caller falls back to Canvas2D). */
export function createWebglRenderer(canvas: HTMLCanvasElement, options: GlyphRendererOptions): GlyphRenderer | null {
  const { cellH, cellW, cols, rows } = options;
  const dprCap = options.dprCap ?? OCEAN_THEME.dprCap;
  const rawDpr = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const dpr = Math.min(rawDpr, dprCap);

  canvas.width = Math.round(cols * cellW * dpr);
  canvas.height = Math.round(rows * cellH * dpr);
  canvas.style.width = `${cols * cellW}px`;
  canvas.style.height = `${rows * cellH}px`;

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false });

  if (!gl) {
    return null;
  }

  const program = gl.createProgram();

  const compile = (type: number, source: string): void => {
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error("createWebglRenderer: createShader failed");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`createWebglRenderer: shader compile failed: ${gl.getShaderInfoLog(shader) ?? "?"}`);
    }

    gl.attachShader(program, shader);
  };

  compile(gl.VERTEX_SHADER, VERTEX_SOURCE);
  compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`createWebglRenderer: link failed: ${gl.getProgramInfoLog(program) ?? "?"}`);
  }

  gl.useProgram(program);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1i(gl.getUniformLocation(program, "uLum"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "uAtlas"), 1);
  gl.uniform1f(gl.getUniformLocation(program, "uCanvasH"), canvas.height);

  const uCellPx = gl.getUniformLocation(program, "uCellPx");
  const uGrid = gl.getUniformLocation(program, "uGrid");
  const uRampLen = gl.getUniformLocation(program, "uRampLen");

  const atlasTextures = new Map<string, { texture: WebGLTexture; glyphCount: number }>();
  const lumPlanes = new Map<number, LumPlane>();
  let lastTotal = cols * rows;

  const configureTexture = (): void => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  const atlasFor = (ramp: string, bin: number): { texture: WebGLTexture; glyphCount: number } => {
    const key = `${bin} ${ramp}`;
    let entry = atlasTextures.get(key);

    if (!entry) {
      const atlas = createGlyphAtlas({
        cellH: cellH * bin,
        cellW: cellW * bin,
        dpr,
        glyphs: ramp,
        ...(options.background === undefined ? {} : { background: options.background }),
        ...(options.fontFamily === undefined ? {} : { fontFamily: options.fontFamily }),
        ...(options.fontScale === undefined ? {} : { fontScale: options.fontScale }),
        ...(options.ink === undefined ? {} : { ink: options.ink }),
      });
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.source);
      configureTexture();
      entry = { glyphCount: atlas.glyphs.length, texture };
      atlasTextures.set(key, entry);
    }

    return entry;
  };

  const lumPlaneFor = (bin: number): LumPlane => {
    let plane = lumPlanes.get(bin);

    if (!plane) {
      const width = Math.ceil(cols / bin);
      const height = Math.ceil(rows / bin);
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      configureTexture();
      plane = {
        bytes: new Uint8Array(width * height),
        height,
        scratch: bin === 1 ? null : createBuffer(width, height),
        texture,
        width,
      };
      lumPlanes.set(bin, plane);
    }

    return plane;
  };

  return {
    canvas,
    cellH,
    cellW,
    clear(): void {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    cols,
    dpr,
    draw(buffer: LuminanceBuffer, ramp: string, drawOptions?: { bin?: 1 | 2 | 4 }): void {
      if (buffer.width !== cols || buffer.height !== rows) {
        throw new Error(`draw: buffer must be ${cols}x${rows}, got ${buffer.width}x${buffer.height}`);
      }

      const bin = drawOptions?.bin ?? 1;
      const plane = lumPlaneFor(bin);
      const source = plane.scratch ? binBuffer(buffer, bin, plane.scratch) : buffer;
      const data = source.data;
      const bytes = plane.bytes;

      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = ((data[i] ?? 0) * 255) | 0;
      }

      const atlas = atlasFor(ramp, bin);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, plane.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, plane.width, plane.height, gl.RED, gl.UNSIGNED_BYTE, bytes);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform2f(uCellPx, cellW * bin * dpr, cellH * bin * dpr);
      gl.uniform2i(uGrid, plane.width, plane.height);
      gl.uniform1f(uRampLen, atlas.glyphCount);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      lastTotal = plane.width * plane.height;
    },
    rows,
    stats(): { dirtyCells: number; totalCells: number } {
      // The WebGL path repaints every cell every frame at constant cost.
      return { dirtyCells: lastTotal, totalCells: lastTotal };
    },
  };
}
