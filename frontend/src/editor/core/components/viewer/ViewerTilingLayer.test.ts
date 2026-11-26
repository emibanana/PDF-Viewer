import { describe, expect, test } from "vitest";
import type { Tile } from "@embedpdf/plugin-tiling/react";
import {
  applyListed,
  createTileModel,
  drawnTiles,
  markPainted,
} from "@editor/components/viewer/ViewerTilingLayer";

function tile(scale: number, col: number, isFallback = false): Tile {
  const rect = { origin: { x: col * 100, y: 0 }, size: { width: 100, height: 100 } };
  return {
    id: `s${scale}-c${col}`,
    status: "ready",
    screenRect: rect,
    pageRect: rect,
    isFallback,
    srcScale: scale,
    col,
    row: 0,
  };
}

const ids = (tiles: Tile[]) => tiles.map((t) => t.id);

describe("ViewerTilingLayer tile model", () => {
  test("keeps the previous zoom's painted tiles until every new tile has painted", () => {
    const model = createTileModel();
    applyListed(model, [tile(1, 0), tile(1, 1)]);
    markPainted(model, "s1-c0");
    markPainted(model, "s1-c1");

    // The plugin drops the old tiles once the new bitmaps exist, before they decode.
    applyListed(model, [tile(2, 0), tile(2, 1)]);
    expect(ids(drawnTiles(model))).toEqual(["s1-c0", "s1-c1", "s2-c0", "s2-c1"]);

    markPainted(model, "s2-c0");
    expect(ids(drawnTiles(model))).toContain("s1-c0");

    markPainted(model, "s2-c1");
    expect(ids(drawnTiles(model))).toEqual(["s2-c0", "s2-c1"]);
  });

  test("keeps the last full set through a run of zoom steps that never finished painting", () => {
    const model = createTileModel();
    applyListed(model, [tile(1, 0)]);
    markPainted(model, "s1-c0");

    applyListed(model, [tile(1, 0, true), tile(2, 0), tile(2, 1)]);
    markPainted(model, "s2-c0");
    // Next step before scale 2 finished: the plugin carries only the ready scale-2 tile.
    applyListed(model, [tile(2, 0, true), tile(3, 0)]);

    expect(ids(drawnTiles(model))).toEqual(
      expect.arrayContaining(["s1-c0", "s2-c0", "s3-c0"]),
    );
  });

  test("does not keep same-zoom tiles that scrolled out of range", () => {
    const model = createTileModel();
    applyListed(model, [tile(1, 0), tile(1, 1)]);
    markPainted(model, "s1-c0");
    markPainted(model, "s1-c1");

    applyListed(model, [tile(1, 1), tile(1, 2)]);
    expect(ids(drawnTiles(model))).toEqual(["s1-c1", "s1-c2"]);
  });

  test("never keeps a tile that had not painted", () => {
    const model = createTileModel();
    applyListed(model, [tile(1, 0)]);
    applyListed(model, [tile(2, 0)]);
    expect(ids(drawnTiles(model))).toEqual(["s2-c0"]);
  });

  test("draws one entry per id when a fallback and its replacement share it", () => {
    const model = createTileModel();
    applyListed(model, [tile(1, 0, true), tile(1, 0)]);
    const drawn = drawnTiles(model);
    expect(ids(drawn)).toEqual(["s1-c0"]);
    expect(drawn[0].isFallback).toBe(false);
  });
});
