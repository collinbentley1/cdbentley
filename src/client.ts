import { scoreBoard, serializeBoard, type Lesson, type Pixel } from "./lesson.ts";

const lessonEndpoint = "/api/lesson";
const scoreEndpoint = "/api/score";
const cellCount = 11;
const boardPixels = cellCount * cellCount;
const root = document.documentElement;
const nameNode = getElement("name");
const noteNode = getElement("note");
const factsNode = getElement("facts");
const meterNode = getElement("meter");
const boardCanvas = getCanvas("board");
const targetCanvas = getCanvas("target");
const resetButton = getElement("reset");
const shuffleButton = getElement("shuffle");
const boardContext = getContext(boardCanvas);
const targetContext = getContext(targetCanvas);

let lesson: Lesson | null = null;
let board: Pixel[][] = [];

void start();

async function start(seed = new URLSearchParams(location.search).get("seed") ?? undefined): Promise<void> {
  lesson = await fetchLesson(seed);
  board = lesson.start.map((row) => [...row]);
  renderLesson(lesson);
  render();
}

async function fetchLesson(seed?: string): Promise<Lesson> {
  const url = new URL(lessonEndpoint, location.origin);

  if (seed) {
    url.searchParams.set("seed", seed);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Lesson request failed: ${response.status}`);
  }

  return (await response.json()) as Lesson;
}

function renderLesson(nextLesson: Lesson): void {
  nameNode.textContent = nextLesson.name;
  noteNode.textContent = nextLesson.note;
  factsNode.replaceChildren(...nextLesson.facts.map((fact) => tag("span", fact)));
  drawGrid(targetContext, nextLesson.glyph, targetCanvas.clientWidth);
}

function render(): void {
  if (!lesson) {
    return;
  }

  drawGrid(boardContext, board, boardCanvas.clientWidth);
  const score = scoreBoard(board, lesson.glyph);
  meterNode.textContent = score.line;
  root.dataset.solved = String(score.solved);
}

function flipCell(event: PointerEvent): void {
  if (!lesson) {
    return;
  }

  const rect = boardCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * cellCount);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * cellCount);

  if (x < 0 || y < 0 || x >= cellCount || y >= cellCount) {
    return;
  }

  board[y]![x] = board[y]![x] === 1 ? 0 : 1;
  render();
  void syncScore();
}

async function syncScore(): Promise<void> {
  if (!lesson) {
    return;
  }

  const score = scoreBoard(board, lesson.glyph);
  if (!score.solved) {
    return;
  }

  const url = new URL(scoreEndpoint, location.origin);
  url.searchParams.set("seed", lesson.seed);
  url.searchParams.set("board", serializeBoard(board));

  const response = await fetch(url);
  const body = (await response.json()) as { line?: string };
  meterNode.textContent = body.line ?? score.line;
}

function drawGrid(context: CanvasRenderingContext2D, pixels: readonly (readonly Pixel[])[], size: number): void {
  const ratio = window.devicePixelRatio || 1;
  const canvas = context.canvas;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size, size);

  const styles = getComputedStyle(root);
  const off = styles.getPropertyValue("--pixel-off").trim();
  const on = styles.getPropertyValue("--pixel-on").trim();
  const ink = styles.getPropertyValue("--ink").trim();
  const cell = size / cellCount;

  context.fillStyle = off;
  context.fillRect(0, 0, size, size);
  context.fillStyle = on;

  for (let y = 0; y < cellCount; y += 1) {
    for (let x = 0; x < cellCount; x += 1) {
      if (pixels[y]?.[x] === 1) {
        context.fillRect(Math.floor(x * cell) + 1, Math.floor(y * cell) + 1, Math.ceil(cell) - 2, Math.ceil(cell) - 2);
      }
    }
  }

  context.strokeStyle = ink;
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function shuffleBoard(): void {
  if (!lesson) {
    return;
  }

  board = board.map((row, y) => row.map((cell, x) => (((x + y * 2 + Date.now()) % 3 === 0 ? 1 - cell : cell) as Pixel)));
  render();
}

function tag(name: string, text: string): HTMLElement {
  const element = document.createElement(name);
  element.textContent = text;
  return element;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element;
}

function getCanvas(id: string): HTMLCanvasElement {
  const element = getElement(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Expected canvas: ${id}`);
  }

  return element;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }

  return context;
}

boardCanvas.addEventListener("pointerdown", flipCell);
resetButton.addEventListener("click", () => {
  if (!lesson) {
    return;
  }

  board = lesson.start.map((row) => [...row]);
  render();
});
shuffleButton.addEventListener("click", shuffleBoard);
window.addEventListener("resize", render);
