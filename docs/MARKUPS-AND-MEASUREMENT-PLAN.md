# Bluebeam-style markups, measurement and the Markups List

Status: in progress (started 2026-11-27). Roadmap items: P2 "Markup model and Properties panel (M0)", "Markups List grid", "CSV summaries"; P4 "Calibration, length, area, perimeter, volume". This plan pulls the first slice of each forward so that a user can calibrate a drawing, take off quantities and export them, the way a Revu user does with the Measurements panel and the Markups List.

## Goal of this slice

A user opens a drawing and can:

1. Set the page scale (preset ratio or calibrate by clicking a known distance), per page.
2. Draw six measurement markups: **Length**, **Polylength**, **Curve**, **Area**, **Wall** (polylength with a wall height, gives wall area) and **Volume** (area with a depth, gives volume). Area also reports its perimeter.
3. Select a markup and edit it live in a right-hand **Properties panel**: subject, label, comments, colour, fill colour, transparency, line width, line style, height or depth, and see its measured values.
4. See every markup on the document in a bottom **Markups List** grid: sort, filter, show/hide and reorder columns, group by subject with subtotals and a grand total, click a row to jump to the markup, set status.
5. Export the list to **CSV**.
6. Save with Ctrl+S, reopen, and find the markups, values and page scales intact. Other viewers (Acrobat, Revu) show them as standard measurement annotations with the measured value in their comment.

Out of this slice (later phases): count tool, cutouts, snapping to PDF geometry, Tool Chest, layers, spaces, custom columns editor, XLSX export, XFDF, writing Revu-private keys we have not verified.

## Data model

Every measurement markup is a normal EmbedPDF annotation, so selection, move, resize, vertex editing, undo and save all come from the annotation plugin.

| Tool | PDF subtype | `/IT` intent | Values |
| --- | --- | --- | --- |
| Length | Line | `LineDimension` | length |
| Polylength | PolyLine | `PolyLineDimension` | length |
| Curve | PolyLine (vertices sampled along a Catmull-Rom spline through the clicked points, so every viewer draws a curve) | `PolyLineDimension` | length along the curve |
| Area | Polygon | `PolygonDimension` | area, perimeter |
| Wall | PolyLine | `PolyLineDimension` | length, height, wall area = length × height |
| Volume | Polygon | `PolygonDimension` | area, perimeter, depth, volume = area × depth |

Fields:

- Standard keys, through EmbedPDF's own model: `subject` (`/Subj`), `author` (`/T`), `contents` (`/Contents`), `created` / `modified`, `strokeColor` (`/C`), `color` (`/IC` fill), `opacity` (`/CA`), `strokeWidth`, `strokeStyle` / dash, `intent` (`/IT`), `linePoints` / `vertices`.
- Our extra fields live in `annotation.custom.markup` (EmbedPDF stores `custom` as JSON in the annotation's `/EPDFCustom` string, so it survives save and reopen):

  ```ts
  interface MarkupCustom {
    v: 1;
    kind: "length" | "polylength" | "curve" | "area" | "wall" | "volume";
    label?: string;
    status?: string;          // free text for now; Revu-style status set comes with replies
    height?: number;          // wall height, in the page scale's unit
    depth?: number;           // volume depth, in the page scale's unit
    controlPoints?: { x: number; y: number }[]; // curve only: the clicked points
  }
  ```

- Measured values are **derived**, never stored as truth: `computeMeasurement(annotation, pageScale)` returns `{ length?, area?, perimeter?, wallArea?, volume?, unit }`. After every create or geometry edit the formatted primary value is written into `contents` (for example `15.67 m`, `13.78 sq m`), which is what Revu and Acrobat show as the comment and what the screenshot's Comments column displays.
- **Page scale** is per page: `{ ratio, unit, factor }` reusing `MeasureScale` and the helpers in `core/utils/measurementUtils.ts` and `measurementTypes.ts`. Read on open from the page's `/VP` viewports through the existing `core/utils/pdfMeasurementExtraction.ts`; written back as a whole-page `/VP` entry with an `/RL` `/Measure` dictionary on save.

### Save pass (compatibility)

`studio/services/pdfEdit/measureDictionaries.ts`, called from `localFileSaveService.ts` next to `ensureFreeTextAppearances`. With pdf-lib, for each annotation whose `/EPDFCustom` holds a `markup`:

- write a `/Measure` dictionary (`/Type /Measure /Subtype /RL /R (1:100)` with `/X`, `/D`, `/A` number-format arrays for the page scale), and make sure `/IT` is set;
- write each page's scale as `/VP` (skip pages that already carry a `/VP` we did not change).

Revu-private keys (for example `/BSIColumnData` for custom columns, and wherever Revu keeps depth and wall height) are **not** written until checked against a real Revu-saved file; record any findings in this document.

### Reading markups from other apps

The Markups List shows every annotation on the document, not only ours: highlights, notes, shapes and Revu or Acrobat measurements. For annotations without `custom.markup`, kind and values come from `/IT`, geometry and the page scale; when geometry cannot give a value the `contents` text is shown as-is.

## UI

| Piece | Where | Behaviour |
| --- | --- | --- |
| Measure toolbar | Top of the Properties panel, also reachable from a viewer bar button | Six tool buttons plus Calibrate. A tool stays armed after a markup is finished (tool lock); Esc disarms. Double-click or Enter finishes polyline, curve and polygon tools |
| Properties panel | Right dock in the viewer, toggled from the viewer bar | With a markup selected: edits apply live (no OK button) and are undoable. With nothing selected but a tool armed: edits set that tool's defaults, remembered per tool in localStorage. Sections: Page Scale (preset list, custom ratio, Calibrate, apply to all pages, precision), Measurement (values read-only; height or depth editable), Appearance (colour, fill, transparency slider, line width, line style), Markup (subject, label, comments, status) |
| Live label | Overlay on the page | Each measurement markup shows its value next to it (like Revu); labels are an overlay layer, not part of the saved appearance |
| Markups List | Bottom dock under the viewer, resizable, toggled from the viewer bar | Columns: Subject, Page Label, Page, Comments, Label, Author, Date, Status, Colour, Length, Area, Perimeter, Wall Area, Volume, Height/Depth, Unit, Type. Show/hide and reorder columns (menu), sort by header click, text filter, group by subject (default on) with per-group subtotal rows and a grand-total row, collapse/expand groups, click a row to select and scroll to the markup, double-click to edit in Properties, hide/show selected markups, delete. Column layout persists in localStorage |
| CSV export | Markups List header button | Visible columns in the current sort and filter, one row per markup plus subtotal and total rows; UTF-8 with BOM so Excel opens it; values as numbers, units in their own column. Saved through the Tauri save dialog |

Scale is required for real-world units: when a page has no scale, values show in paper units (pt or mm) and the panel shows "Scale not set" like Revu.

## Code layout

New code in `frontend/src/editor/studio/` only, except for small, logged seams in `core/`.

| Path (under `studio/`) | Owns |
| --- | --- |
| `services/markups/markupModel.ts` | `MarkupCustom`, kinds, tool ids, intent mapping, reading `custom.markup` safely |
| `services/markups/measureMath.ts` | Length, polylength, shoelace area, perimeter, wall area, volume, curve sampling, unit conversion and formatting |
| `services/markups/pageScaleStore.ts` | Per-file, per-page scales (external store with `useSyncExternalStore`), seeded from `/VP` on open |
| `services/markups/markupsStore.ts` | Live list of the open document's annotations as `MarkupRow`s, kept in step with annotation plugin events |
| `services/markups/csvExport.ts` | CSV text from rows and visible columns |
| `services/pdfEdit/measureDictionaries.ts` | The save pass above |
| `components/viewer/markups/measureTools.ts` | Registers the six annotation tools with the annotation plugin |
| `components/viewer/markups/PropertiesPanel.tsx` (+ css) | Right dock |
| `components/viewer/markups/MarkupsList.tsx` (+ css) | Bottom dock, built on `@tanstack/react-table` and `@tanstack/react-virtual` (already dependencies) |
| `components/viewer/markups/MeasureLabelLayer.tsx` | Value labels on the page |

Seams in `core/` (log each in `docs/core-patches.md`): core ships null placeholders `core/components/viewer/markups/MarkupsRightDock.tsx`, `MarkupsBottomDock.tsx` and `MeasureLabelLayer.tsx` (plus a no-op tool registration hook) and mounts them in the viewer; studio shadows them at the same paths. Same pattern as `ReaderLeftPanel`.

Strings go in `frontend/public/locales/en-US/translation.toml` under a `markups.` section.

## Steps

| # | Step | Done when |
| --- | --- | --- |
| 1 | Foundation: model, math, page scale store, six tools registered, measured value written into `contents`, seams mounted (empty docks), save pass | Unit tests for math, curve sampling and the save pass (pdf-lib round trip: `/Measure`, `/IT`, `/VP` present and readable by `pdfMeasurementExtraction`). Tools draw in the viewer (status: implemented, not yet exercised in the running app) |
| 2 | Properties panel and Measure toolbar, calibration, live labels | Select a markup, change colour, transparency, height: annotation and label update live; set or calibrate scale and values change |
| 3 | Markups List and CSV export | Grid lists all annotations with values, grouping, subtotals, totals, column show/hide and reorder, sort, filter, row click selects; CSV opens in Excel with the same rows |
| 4 | Test pass | Checks clean; a written test report of what was exercised in the running app and what failed |

Checks after every step, from `frontend/`: `npx tsc --noEmit -p tsconfig.studio.vite.json`, `npx oxlint --config oxlint.config.ts --max-warnings=0`, `npx vitest run --project core --project studio`.

## Implementation notes (step 1)

Written for whoever builds steps 2 and 3.

**Seams.** Core ships null versions under `core/components/viewer/markups/`; the studio versions shadow them at the same `@editor/components/viewer/markups/<name>` path: `useMarkupTools` (takes `{enabled, file}`, registers tools, sync and controller), `useMarkupBarButtons` (the two viewer-bar toggles), `useMarkupDockLayout` (returns `{rightPx, bottomPx}`), `MarkupsRightDock` (prop `rightOffsetRem`), `MarkupsBottomDock`, `MeasureLabelLayer` (props `documentId`, `pageIndex`). Steps 2 and 3 replace the body of the two dock files; the layout hook already reserves their space.

**Stores and controller** (all under `studio/services/markups/`).
- `pageScaleStore`: `usePageScale(fileKey, pageIndex)`, `getPageScale`, `getMeasureScale`, `setPageScale`, `setScaleForPages`, `setPagePrecision`, `clearPageScale`, `getActiveFileKey`. Keyed by the lineage-root file id (`stub.originalFileId`); `aliasFileKey` maps each version's file id to it so the save path finds the scales. Scales read from a file's `/VP` have `source: "file"` and are never written back; only `source: "user"` ones are saved.
- `markupsUiStore`: `useMarkupsUi(selector)`, `setMarkupsUi`, `toggleRightDock`, `toggleBottomDock`. Holds dock open state and sizes (persisted under `markups.ui`), `selectedAnnotationId`, `selectedPageIndex`, `armedToolId`.
- `markupController`: `armMeasureTool`, `disarmTool`, `selectMarkup(pageIndex, id, {scroll})`, `scrollToMarkup`, `deselectMarkup`, `updateMarkup(pageIndex, id, patch)` (undoable), `deleteMarkups`, `listAnnotations`. No-ops until a document is bound.
- `markupContents.computeMarkupPatch(annotation, pageScale)` is the single place that decides `contents` and default wall height / slab depth; reuse it when a panel edit should re-derive the label.

**Events.** Update events carry the pre-patch annotation plus the `patch`; the new state is `{...annotation, ...patch}`. Events fire synchronously before the commit, so `syncAnnotationObject` (no history entry, no dirtying) lands inside the same commit and creation stays one undo step. A user scale change goes through `updateAnnotations`, so it is undoable and marks the document changed. Selection is mirrored into `markupsUiStore` by `attachMarkupUiSync`; read selection from there rather than from the plugin.

**Custom fields.** Everything of ours lives in `custom.markup` (`/EPDFCustom`): `kind`, `label`, `status`, `height`, `depth`, `controlPoints` (curve), `manualContents`. Step 2 must set `manualContents: true` when the user types a comment, otherwise the measured value overwrites it. A curve's `controlPoints` are dropped when its `vertices` change (edited by handle).

**Decisions.**
- Save pass: `/Measure` has `/X` = [{U, C: factor, F: D, D: 10^precision}], `/D` and `/A` with `C: 1`; `/R` is the ratio text. A whole-page `/VP` carries it, ours first, existing region viewports kept. Core's `parseScale` now takes whichever of `/D` and `/X` has a factor other than 1 (logged in `core-patches.md`).
- Pages without a scale measure in paper millimetres (`PAPER_SCALE`) and get no default height or depth until a scale is set.
- Default extents come from `defaultExtent(unit)`: for `m`, wall height 3 and slab depth 0.1.
- Tool defaults: stroke `#e53935`, polygon fill `#ff8a80` at 0.6 opacity, width 2, solid; tools stay armed after each markup; Esc disarms (window handler, ignored inside inputs).

**Not verified.**
- Nothing has been exercised in the running app; only unit tests, tsc, oxlint and comment-lint.
- Revu's exact keys for height, depth and custom columns, and whether Acrobat and Revu read our `/X` and `/D` split the way we intend.
- Dense vertex handles on curves (the annotation has the sampled spline as vertices).
- Arming a tool does not turn the viewer's pan mode off; the Properties toolbar should call the viewer pan API when it arms a tool.
- Full vitest run: all new tests pass; two failures are outside this work (`unusedTranslations`: `workbenchBar.selectLanguage`; three `ZoomAPIBridge` fit-mode tests).

## Open questions

- Exact Revu keys for wall height, depth and custom columns: need a Revu-saved sample with these markups. Until then our values round-trip through `/EPDFCustom` and Revu sees standard measurements without depth.
- Count tool, layers and spaces columns are shown empty in this slice.
- XLSX export: no spreadsheet library in the tree; a small SpreadsheetML writer is the likely route (later).
