# Viewer zoom: the pointer stays pinned

Ctrl/Cmd + wheel (and touchpad pinch) must zoom about the mouse pointer: the page point under the cursor stays under the cursor. This has broken before and is easy to break again, so read this before touching zoom, scroll, the viewport element, page layout or tiling.

## Where it lives

| Piece | File |
| --- | --- |
| Wheel handler, anchor + re-pin | `frontend/src/editor/core/components/viewer/useViewerWheelZoom.ts` (+ `.test.ts`) |
| `zoomBy(factor, center)` on the zoom API | `core/components/viewer/ZoomAPIBridge.tsx`, `core/contexts/viewer/viewerBridges.ts`, `viewerActions.ts` |
| Hook mounted on the viewer root | `core/components/viewer/EmbedPdfViewer.tsx` |
| Viewport and page markers the hook reads | `data-viewer-viewport` (`usePagesPastInset.ts`, set in `LocalEmbedPDF.tsx`), `data-page-index` (`LocalEmbedPDF.tsx`) |
| Patch log | `docs/core-patches.md` |

## Why it jumped, and what fixes it

The EmbedPDF zoom plugin computes the new scroll position from its own cached viewport scroll metrics, then applies it with `scrollTo` inside a `requestAnimationFrame`. Two things go wrong:

1. Wheel and pinch events arrive faster than frames. The cached metrics lag the real DOM scroll, so each step is computed from a stale position and the page drifts or jumps.
2. The plugin's scroll lands a frame after React lays the pages out. If the layout is not already at the new size, the browser clamps the scroll.

The hook does four things, and all four are needed:

0. **Glide.** A wheel event only adds to the zoom still owed (capped at about three notches); an animation-frame loop pays it off exponentially (`SMOOTHING_MS`), so a notch eases in instead of snapping. Every frame is a full step of 1-3 below, with the anchor re-measured at the latest pointer position.
1. **`flushSync` the zoom** so the pages are laid out at the new size before the plugin's frame callback runs.
2. **Anchor on the DOM, not on the plugin.** Before zooming, find the `[data-page-index]` element under the pointer (`document.elementsFromPoint`) and record the pointer as a fraction of that page's rect.
3. **Re-pin twice.** Right after the `flushSync`, and again in a `requestAnimationFrame` queued after the plugin's own, scroll the viewport by the difference between where that page fraction now is and where the pointer is. The second pin is what stops the plugin's stale scroll from winning.

If the pointer is over a gap between pages there is no anchor and the plugin's own centring applies.

## Invariants (do not break)

- Zoom keeps going through `zoomBy` on the zoom API, never `zoomIn`/`zoomOut`, which anchor on the viewport centre.
- Each page element keeps `data-page-index` and its rect must scale with the zoom level. Wrapping pages in an element that does not resize with them, or removing the attribute, silently disables the pin.
- The scroll container must stay the `data-viewer-viewport` element, and nothing may scroll a different ancestor.
- Do not add a second wheel handler that calls `preventDefault` or sets scroll on the viewer, and do not add CSS `scroll-behavior: smooth` to the viewport: either one fights the re-pin.
- Tiling (`ViewerTilingLayer.tsx`) must not change page element size. It keeps the previous zoom's tiles until the new ones decode; that is paint only.

## Checking a change

- `npx vitest run --project core src/editor/core/components/viewer/useViewerWheelZoom.test.ts`
- By hand in `npx tauri dev`: open a multi-page PDF, put the pointer on a distinct word, and Ctrl+wheel in and out quickly, then pinch on a touchpad. The word must stay under the pointer at every step, at fit-width, at 20% (content narrower than the viewport) and at 500%.
