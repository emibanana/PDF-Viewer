export type QuarterTurns = 0 | 1 | 2 | 3;

interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Quarter turns clockwise of a page on screen: its own `/Rotate` plus the document's, in any integer. */
export function normalizeTurns(turns: number | null | undefined): QuarterTurns {
  const value = typeof turns === "number" && Number.isFinite(turns) ? Math.round(turns) : 0;
  return (((value % 4) + 4) % 4) as QuarterTurns;
}

/**
 * Maps a screen point to a point in the page's own space, given the on-screen bounding box of
 * the page element (which is rotated by CSS), the element's unrotated size in the same pixel
 * unit and the quarter turns it is rotated by. The result is in pixels of the unrotated page;
 * divide by the zoom for PDF points.
 */
export function clientToPagePixels(
  client: { x: number; y: number },
  rect: ScreenRect,
  unrotatedSize: { width: number; height: number },
  turns: QuarterTurns,
): { x: number; y: number } {
  const dx = client.x - (rect.left + rect.width / 2);
  const dy = client.y - (rect.top + rect.height / 2);
  const [lx, ly] = turns === 0 ? [dx, dy] : turns === 1 ? [dy, -dx] : turns === 2 ? [-dx, -dy] : [-dy, dx];
  return { x: lx + unrotatedSize.width / 2, y: ly + unrotatedSize.height / 2 };
}
