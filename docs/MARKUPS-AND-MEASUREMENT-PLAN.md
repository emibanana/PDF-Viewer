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
| 2 | Properties panel and Measure toolbar, calibration, live labels | Select a markup, change colour, transparency, height: annotation and label update live; set or calibrate scale and values change (status: implemented, exercised in the browser dev server; see "Implementation notes (step 2)") |
| 3 | Markups List and CSV export | Grid lists all annotations with values, grouping, subtotals, totals, column show/hide and reorder, sort, filter, row click selects; CSV opens in Excel with the same rows (status: implemented; exercised in the browser dev server on a hand-made PDF, not in the Tauri shell) |
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

## Implementation notes (step 2)

Right dock, Page Scale, Properties, tool defaults, calibration and live labels. Everything below lives under `studio/`; no `core/` file was edited.

**Files.** `components/viewer/markups/`: `MarkupsRightDock.tsx` (composition), `MeasureToolbar.tsx`, `PageScaleSection.tsx`, `PropertiesPanel.tsx`, `ToolDefaultsPanel.tsx`, `AppearanceFields.tsx`, `MeasurementValues.tsx` (read-only values and the Height/Depth field), `CalibrateOverlay.tsx`, `MeasureLabelLayer.tsx`, `MarkupsProperties.css`, hooks `useBufferedValue`, `useToolDefaults`, `useMeasureActions`, `useViewerPage`. `services/markups/`: `annotationBridge` (selected annotation and tool defaults, bound by `useMarkupTools`), `propertyPatches` (every panel edit as an annotation patch), `scalePresets`, `toolDefaults`, `calibrateStore`, `pageGeometry` (click to page point on a rotated page), `labelPlacement`. Additive edits to step 1 files: `useMarkupTools` binds the bridge and applies stored tool defaults; `pageScaleStore` gained `useActiveFileKey`; `MarkupsDocks.css` label colours.

**Decisions.**
- The dock is mounted outside the EmbedPDF provider, so it cannot use the plugin hooks. `annotationBridge` mirrors the selected annotation object into a `useSyncExternalStore` store and wraps `getTool`/`setToolDefaults`.
- The dock root carries `data-no-interaction`. Core's `AnnotationSelectionMenu` deselects on any `pointerdown` outside the menu unless the target is inside `[data-no-interaction]` or a Mantine popover, so without the attribute the first click in the dock would clear the selection. Any other panel that edits the selection (the Markups List dock) needs the same attribute.
- Panel edits go through `updateMarkup`, one undo step each. Text, slider, number and colour fields commit through `useBufferedValue` (350 ms of quiet, on blur, on unmount), so typing is not one undo step per key.
- Comment: typing marks `custom.markup.manualContents`; clearing the box or the "Reset to measured value" button removes the mark and rewrites `/Contents` with the formatted measurement. A comment on an annotation that is not ours is a plain `/Contents` write.
- Label (`custom.markup.label`) exists for our own markups only; foreign annotations show Subject, Comments and Appearance.
- Slider is "Opacity" (100% = solid), not transparency: it writes `/CA` directly. Fill colour shows only for polygon, square and circle annotations that have an interior colour; line style dashed writes `strokeDashArray` as `[3w, w]` and follows later width changes.
- Wall height and slab depth are editable only once the page has a scale (their unit is the scale's unit); until then the panel says "Scale not set".
- Page scale panel follows the selected markup's page, else the page in view (`useViewerPage`, from the viewer's scroll bridge). Presets: metric 1:1 to 1:1000 in metres, imperial in feet (1/4" = 1'-0" is ratio 48). "Apply to all pages" is a checkbox: ticking copies the current scale and precision to every page, and while ticked a preset, a typed ratio, a precision change or a calibration goes to every page. A scale equal to a preset (also a calibrated one) shows the preset's name.
- Calibrate: the dock button starts `calibrateStore`; `CalibrateOverlay` (one per page, mounted by `MeasureLabelLayer`) takes the two clicks, converts them with the page's zoom and rotation to PDF points and swallows the pointer events so nothing underneath is selected or drawn. The distance dialog is core's `ScaleCalibrationDialog`; cancelling it goes back to picking, Esc leaves calibration. Closing the dock cancels it. The scale applies to the page the points were on.
- Arming a tool or starting calibration disables the viewer's pan mode through `panActions.disablePan()`. Text selection needs no call: the annotation plugin's armed tool replaces the default interaction mode. Arming also cancels calibration.
- Tool defaults: with no selection and a measurement tool armed the same Subject, Appearance (fill for area and volume) and Height/Depth fields edit that tool. Each change is applied with `setToolDefaults` and saved per tool under `markups.toolDefaults` in localStorage; `useMarkupTools` re-applies them when the viewer binds. Height and depth defaults are numbers in the unit of whichever page the next markup lands on. A freshly drawn markup is selected (the tool stays armed), so the panel then shows that markup's properties; deselect to edit the defaults again.
- Labels are computed from geometry and the page scale, not read from `/Contents`, so a typed comment never replaces the value and a scale or precision change updates them at once. The anchor is the middle of the path (lines) or the centroid (areas). They stay one screen size at any zoom, are turned back upright on rotated pages, take the stroke colour with a readable text colour, and are skipped for hidden, no-view or invisible annotations.

**Exercised** (dev server in the browser pane, a two-page generated PDF): preset 1:100, draw Length (label 9.95 m), Wall (length x height, edit height to 2.5, label and comment follow), edit comment, line width, dashed, calibrate (two clicks, dialog, 1:50.26 applied, label changed to 5.00 m), apply preset to all pages, rotate the document 90 degrees (label stays upright), new markup picks up a stored tool default.

**Not verified.** Tauri build; undo and redo of panel edits and their effect on the label; Area, Volume, Polylength and Curve through the panel; calibrating on a rotated page by clicking; colour picker popover inside the dock; a file with `/VP` scales; multiple documents open; the core ruler (`isRulerActive` is local state in `EmbedPdfViewer`, so arming a measure tool cannot turn it off); the dock on a narrow window.

## Implementation notes (step 3)

**Files** (under `studio/`). `services/markups/markupRows.ts` (annotation to `MarkupRow`, facet and text filters, totals, grouping), `markupColumns.ts` (column specs, display text, persisted layout), `csvExport.ts` (pure CSV text), `csvSave.ts` (save dialog or browser download), `useMarkupRows.ts` (rows hook and language-dependent names); `components/viewer/markups/MarkupsList.tsx` (grid), `MarkupsListToolbar.tsx`, `MarkupsList.css`; `MarkupsBottomDock.tsx` now only hosts the resize edge and the list.

**Additive changes to step 1.** `markupController.ts` gained `subscribeMarkupAnnotations`, `getMarkupAnnotationsVersion`, `getMarkupSelection` (fed by the annotation plugin's `onStateChange`, coalesced to one notification per frame), `toggleMarkupSelection`, `setMarkupSelection`, `updateMarkups` (batch, one undo step). `showSaveDialog` takes an optional file filter (default PDF).

**Grid.** `@tanstack/react-table` v9 owns sorting, column order, visibility and sizing/resizing (controlled from the persisted layout); `@tanstack/react-virtual` virtualises one flat list of group and markup rows at a fixed 24 px. Filtering and grouping are plain functions in `markupRows.ts`, so they are unit tested. Sorting applies inside each group; groups are ordered by subject (Z to A when Subject is sorted descending). Layout (order, hidden columns, widths, sort, grouping) persists under `markups.list.layout`; filters, search and collapsed groups do not.

**Decisions.**
- Selection lives in the annotation plugin, not in the list: row highlight, Ctrl (toggle), Shift (range over the visible rows), Ctrl+A, arrow keys and Delete go through `setSelection`/`toggleSelection`/`deleteAnnotations`, so list and pages cannot disagree. The list root carries `data-no-interaction`, otherwise the viewer's click-outside handler deselects before a Ctrl-click lands.
- Status values are Accepted, Rejected, Cancelled, Completed (none is empty). Own measurements keep it in `custom.markup.status`; every other annotation in `custom.markupMeta.status` (`markup` needs a measurement kind). A status chosen on a selected row applies to the whole selection.
- Hide/show sets or clears the `hidden` PDF flag through `updateAnnotations`; the page layer stops drawing hidden annotations and the row is greyed.
- Subtotals add only rows in the same unit; otherwise "—". Unit column of a group shows its one unit or "—". Values on a page without a scale are paper millimetres.
- Default columns: Subject, Page Label, Comments, Author, Date, Status, Colour, Length, Area, Wall Area, Volume, Unit; Label, Perimeter, Height/Depth and Type are available from the column menu. Page Label is the page number: the engine exposes no `/PageLabels`.
- Links, popups, widgets and other non-markup subtypes are not listed.
- CSV: first column "Row type" (Markup, Subtotal, Total), then the visible columns in order. Grouped export puts a subtotal row before each group's markups (subject cell "Slab (3)"); a "Group" column is added only when Subject is not exported. Numbers use the row's page precision, `.` decimals; dates are `YYYY-MM-DD HH:mm:ss` local time; mixed-unit sums are empty and the unit cell says "mixed". UTF-8 BOM, CRLF, RFC 4180 quoting. Text cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading apostrophe so Excel does not run PDF text as a formula. Default name `<pdf name> - Markups.csv`.

**Found while testing.**
- The EmbedPDF engine reads `/IT` only for ink, caret and free-text annotations: a Line, PolyLine or Polygon written by Revu or Acrobat arrives without `intent`, so `markupKindOf` cannot recognise it and the list shows it as Line or Polygon with its `contents` text and no computed values. Our own measurements are unaffected (`custom.markup.kind`). Fixing it needs an engine patch (`scripts/embedpdfEnginesPatch.mts`) that adds `intent` to `readBaseAnnotationProperties`.
- Any edit made through the plugin (status, hide) stamps the annotation's author with the current user ("Guest" in the dev server), replacing the author read from the file.

**Not verified.** Everything above was exercised only in the Vite dev server in a browser tab with a hand-written PDF (own measurements, highlight, note, shapes): list contents, group subtotals and total, row click and viewer-to-list sync with scrolling, Ctrl-click multi-select, Delete, status dropdown, hide/show, search, sort, column resize and persistence, collapse/expand and ungroup, CSV text (captured from the browser-download path). Not exercised: the Tauri save dialog path, Shift-range selection, column reordering from the menu, drag-resizing the dock while the list is open, lists of thousands of markups (virtualisation is by construction), mixed scales across pages in the app (covered by unit tests), undo of delete and of status edits.

## Integration fixes (after steps 2 and 3)

- **Author kept on edit.** The annotation plugin stamps `patch.author ?? annotationAuthor` on every update, from any UI (floating menu, vertex drag, status change). `markupSync.ts` writes the annotation's original author back in the same uncommitted update, so a Revu reviewer's name survives our edits.
- **`/IT` read for every subtype.** EmbedPDF read `/IT` only for ink, caret and free text, so Revu and Acrobat measurements (Line, PolyLine, Polygon with a `*Dimension` intent) loaded as plain shapes. `frontend/scripts/embedpdfEnginesPatch.mts` now adds `intent` to `readBaseAnnotationProperties` in both the direct and the worker engine (site "annotation intent on every subtype", covered by `embedpdfEnginesPatch.test.ts`).

## Open questions

- Exact Revu keys for wall height, depth and custom columns: need a Revu-saved sample with these markups. Until then our values round-trip through `/EPDFCustom` and Revu sees standard measurements without depth.
- Count tool, layers and spaces columns are shown empty in this slice.
- XLSX export: no spreadsheet library in the tree; a small SpreadsheetML writer is the likely route (later).
