import { describe, expect, test } from "bun:test";
import { buildLesson, parseBoard, scoreBoard, serializeBoard } from "../src/lesson.ts";

describe("lesson generation", () => {
  test("includes Collin Bentley and profile facts", () => {
    const lesson = buildLesson("classroom");

    expect(lesson.name).toBe("Collin Bentley");
    expect(lesson.facts).toContain("Yale CS 2019");
    expect(lesson.facts).toContain("PearVC PearX founder");
    expect(lesson.facts).toContain("former teacher");
    expect(lesson.glyph).toHaveLength(11);
    expect(lesson.glyph[0]).toHaveLength(11);
  });

  test("is deterministic for a seed", () => {
    expect(buildLesson("pearx").start).toEqual(buildLesson("pearx").start);
  });
});

describe("board scoring", () => {
  test("detects solved boards", () => {
    const lesson = buildLesson("solved");
    const score = scoreBoard(lesson.glyph, lesson.glyph);

    expect(score.solved).toBe(true);
    expect(score.line).toBe("class dismissed");
  });

  test("round-trips serialized boards", () => {
    const lesson = buildLesson("round-trip");
    const serialized = serializeBoard(lesson.start);

    expect(parseBoard(serialized)).toEqual(lesson.start.map((row) => [...row]));
  });
});
