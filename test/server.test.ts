import { describe, expect, test } from "bun:test";
import { handleRequest } from "../src/server.ts";
import { buildLesson, serializeBoard } from "../src/lesson.ts";

describe("server", () => {
  test("serves a lesson api response", async () => {
    const response = await handleRequest(new Request("http://localhost/api/lesson?seed=yale"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Collin Bentley");
    expect(body.seed).toBe("yale");
  });

  test("scores solved boards through the api", async () => {
    const lesson = buildLesson("api");
    const board = serializeBoard(lesson.glyph);
    const response = await handleRequest(new Request(`http://localhost/api/score?seed=api&board=${board}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.solved).toBe(true);
  });

  test("rejects malformed score boards", async () => {
    const response = await handleRequest(new Request("http://localhost/api/score?seed=api&board=bad"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("bad board");
  });
});
