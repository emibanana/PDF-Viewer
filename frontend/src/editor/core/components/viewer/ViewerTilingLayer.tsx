import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { useTilingCapability, type Tile } from "@embedpdf/plugin-tiling/react";
import { ignore, PdfErrorCode } from "@embedpdf/models";

/**
 * Page tiles that never leave a hole while the zoom changes.
 *
 * EmbedPDF's TilingLayer drops the previous zoom's tiles as soon as the new
 * tiles' bitmaps exist, before their <img> elements have decoded, and during a
 * fast run of zoom steps it drops them once any intermediate tile is ready. In
 * both gaps the low-resolution page preview shows through, which reads as a
 * flash. This layer keeps every painted tile the plugin stops listing until
 * all tiles at the current zoom have decoded, then lets them go.
 */

/** Bounds the kept tiles if a tile at the current zoom never paints. */
const MAX_RETAINED_TILES = 96;

export interface TileModel {
  /** The plugin's array for this page, by reference, to skip unrelated updates. */
  source: Tile[] | null;
  listed: Tile[];
  retained: Map<string, Tile>;
  painted: Set<string>;
}

function uniqueById(tiles: Tile[]): Tile[] {
  // A zoom straight back to the previous level can list a fallback and its
  // replacement under one id; the replacement is the one to draw.
  const byId = new Map<string, Tile>();
  for (const tile of tiles) {
    const seen = byId.get(tile.id);
    if (!seen || seen.isFallback) byId.set(tile.id, tile);
  }
  return byId.size === tiles.length ? tiles : [...byId.values()];
}

function settle(model: TileModel) {
  const current = model.listed.filter((t) => !t.isFallback);
  if (
    current.length === 0 ||
    current.every((t) => model.painted.has(t.id))
  ) {
    model.retained.clear();
  } else {
    const scale = current[0].srcScale;
    for (const [id, tile] of model.retained) {
      // Same-zoom tiles that scrolled out of range cover nothing on screen.
      if (tile.srcScale === scale) model.retained.delete(id);
    }
    for (const id of model.retained.keys()) {
      if (model.retained.size <= MAX_RETAINED_TILES) break;
      model.retained.delete(id);
    }
  }
  const drawn = new Set(model.listed.map((t) => t.id));
  for (const id of model.retained.keys()) drawn.add(id);
  for (const id of model.painted) {
    if (!drawn.has(id)) model.painted.delete(id);
  }
}

export function createTileModel(): TileModel {
  return { source: null, listed: [], retained: new Map(), painted: new Set() };
}

/** The tiles to draw, kept ones first so the current zoom's tiles paint over them. */
export function drawnTiles(model: TileModel): Tile[] {
  return [...model.retained.values(), ...model.listed];
}

export function markPainted(model: TileModel, tileId: string) {
  model.painted.add(tileId);
  settle(model);
}

export function applyListed(model: TileModel, next: Tile[]) {
  const nextIds = new Set(next.map((t) => t.id));
  for (const tile of model.listed) {
    if (!nextIds.has(tile.id) && model.painted.has(tile.id)) {
      model.retained.set(tile.id, tile);
    }
  }
  for (const id of nextIds) model.retained.delete(id);
  model.listed = uniqueById(next);
  settle(model);
}

interface TileImageProps {
  documentId: string;
  pageIndex: number;
  tile: Tile;
  scale: number;
  onPainted: (tileId: string) => void;
}

function TileImage({
  documentId,
  pageIndex,
  tile,
  scale,
  onPainted,
}: TileImageProps) {
  const { provides: tiling } = useTilingCapability();
  const scope = useMemo(
    () => tiling?.forDocument(documentId),
    [tiling, documentId],
  );
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  // Keyed by tile id only: the tile object changes with its status, and a
  // re-render per status change would render the same bitmap again.
  useEffect(() => {
    if (!scope) return undefined;
    const task = scope.renderTile({
      pageIndex,
      tile,
      dpr: window.devicePixelRatio,
    });
    task.wait((blob) => {
      urlRef.current = URL.createObjectURL(blob);
      setUrl(urlRef.current);
    }, ignore);
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      } else {
        task.abort({
          code: PdfErrorCode.Cancelled,
          message: "canceled render task",
        });
      }
    };
  }, [scope, pageIndex, tile.id]);

  const handleLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      const done = () => {
        // The decoded image outlives its blob URL.
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
        onPainted(tile.id);
      };
      img.decode().then(done, done);
    },
    [onPainted, tile.id],
  );

  if (!url) return null;
  const relativeScale = scale / tile.srcScale;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onLoad={handleLoad}
      style={{
        position: "absolute",
        left: tile.screenRect.origin.x * relativeScale,
        top: tile.screenRect.origin.y * relativeScale,
        width: tile.screenRect.size.width * relativeScale,
        height: tile.screenRect.size.height * relativeScale,
        display: "block",
      }}
    />
  );
}

export function ViewerTilingLayer({
  documentId,
  pageIndex,
}: {
  documentId: string;
  pageIndex: number;
}) {
  const { provides: tiling } = useTilingCapability();
  const scale = useDocumentState(documentId)?.scale ?? 1;
  const modelRef = useRef<TileModel>(createTileModel());
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!tiling) return undefined;
    return tiling.onTileRendering((event) => {
      if (event.documentId !== documentId) return;
      const next = event.tiles[pageIndex] ?? [];
      const model = modelRef.current;
      if (next === model.source) return;
      model.source = next;
      applyListed(model, next);
      rerender();
    });
  }, [tiling, documentId, pageIndex]);

  const handlePainted = useCallback((tileId: string) => {
    markPainted(modelRef.current, tileId);
    rerender();
  }, []);

  return (
    <div>
      {drawnTiles(modelRef.current).map((tile) => (
        <TileImage
          key={tile.id}
          documentId={documentId}
          pageIndex={pageIndex}
          tile={tile}
          scale={scale}
          onPainted={handlePainted}
        />
      ))}
    </div>
  );
}
