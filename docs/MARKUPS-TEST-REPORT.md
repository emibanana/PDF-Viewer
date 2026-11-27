# Markups, measurement, Properties panel and Markups List: test report

Date: 2026-11-27
Scope: step 4 of `docs/MARKUPS-AND-MEASUREMENT-PLAN.md`. Bugs are reported, not fixed. No source, test or translation was changed.

## Environment

- App: Vite dev server `http://localhost:5173` (studio mode, browser build), exercised in the Claude Browser pane at 1600x900 emulation (screenshots are 800x450). Narrow check at about 1000px.
- Not run: `tauri dev`. The Tauri save dialog, disk save (`saveToLocalPath`), CSV save dialog and Windows user name were therefore unavailable.
- The pane was hidden while testing, so `requestAnimationFrame` was throttled. Frame-rate numbers are invalid; main-thread blocking was measured with a `longtask` PerformanceObserver.
- Test PDFs were generated with `@cantoo/pdf-lib` and live outside the repo, in the session scratchpad `markups-test\`:
  - `drawing-a3.pdf`: 2 pages, A3 landscape.
  - `foreign-revu.pdf`: Revu/Acrobat-style, with LineDimension, PolyLineDimension and PolygonDimension (`/Measure` RL, `/Subj`, `/T`, `/Contents`), a highlight, a sticky note and a page `/VP` at 1:100.
  - `perf-500.pdf`: 500 annotations on one page.
- Saved output was inspected with a Node pdf-lib script (`inspect.mjs`).
- The Tauri save pass was emulated in page context (`ensureFreeTextAppearances` plus `ensureMeasureDictionaries` with `getUserPageScales`), then checked in Node and by reopening the output in the app. This is not the same as running the real save path.
- Measurement values were checked by hand against the page scale for each tool and for the CSV.

## Results

| Area | Check | Result | Evidence / notes |
| --- | --- | --- | --- |
| Page scale | Preset 1:100 m on a page | pass | Values match hand calculation |
| Page scale | Custom ratio | pass | Values match hand calculation |
| Page scale | Calibrate against a known length | pass | Non-rotated page only |
| Page scale | Imperial preset | pass | Units and values correct |
| Page scale | Apply to all pages | pass | Both pages updated |
| Page scale | Foreign `/VP` 1:100 read on open | pass | Panel shows "Page 1: 1:100 (m)" |
| Page scale | Custom ratio field for foreign `/VP` | fail | Shows 100.0001 for factor 0.0352778 (bug 14) |
| Page scale | Undo of a scale change | fail | No visible effect (bug 10) |
| Page scale | Scale survives reload of in-app saved version | fail | Scale lost (bug 3) |
| Page scale | Calibrate on a rotated page | not tested | Ran out of time |
| Tools | Length | pass | Hand-checked |
| Tools | Polylength | pass | Hand-checked |
| Tools | Curve | pass | Hand-checked |
| Tools | Curve vertex handles | fail | About 134 dense handles obscure the line (bug 13) |
| Tools | Area | pass | Hand-checked |
| Tools | Wall | pass | Hand-checked |
| Tools | Volume | pass | Hand-checked |
| Tools | On-page measurement labels (own markups) | pass | `MeasureLabelLayer` |
| Tools | Esc cancels an in-progress shape | pass | One intermittent exception, see next row |
| Tools | Enter finishes polyline, curve, polygon | fail | Does nothing although the panel hint says it does (bug 5) |
| Tools | Draw with a tool armed over an existing annotation | fail | Selects the annotation instead of drawing (bug 7) |
| Tools | Armed tool after switching files | fail | UI shows armed, nothing draws (bug 6) |
| Tools | Stale polyline points after Esc plus dblclick over an existing line | not tested | Seen once (7 vertices), not reproducible |
| Properties | Edit name, subject, comments | pass | Reflected in list |
| Properties | Line colour and width | pass | Applied |
| Properties | Colour picker popover | fail | Deselects markup, swatch not applied (bug 4) |
| Properties | Opacity slider | fail | Can reach 0, markup invisible (bug 15) |
| Properties | Wall height and volume depth edit | pass | Value and label update |
| Properties | Undo of a depth/height edit | fail | `contents` stays stale (bug 9) |
| Properties | Measurement values for foreign measurements | fail | None shown in the panel (bug 12) |
| Properties | Empty state with no selection | pass | "Select a markup to see its properties" |
| Geometry | Drag a vertex updates the measurement | pass | Hand-checked |
| Geometry | Move a whole markup | pass | |
| Geometry | Undo and redo of geometry edits | pass | Only works while the viewer is hovered (`EmbedPdfViewer.tsx`); upstream behaviour |
| Geometry | Foreign markup geometry edit | fail | List Length updates, `contents` stays stale (bug 12) |
| Markups List | Rows, grouping, subject, author, colour | pass | |
| Markups List | Sorting by column | pass | |
| Markups List | Search and filter | pass | |
| Markups List | Click row selects the markup | pass | |
| Markups List | Foreign markups listed with `/T` author and `/Contents` | pass | "Alice Reviewer", comments shown |
| Markups List | Total row with mixed units | fail | Length and Area blank, Wall Area and Volume summed (bug 16) |
| Markups List | Shift-click a row | fail | Selects row text (bug 17) |
| CSV export | Ungrouped | pass | `out/ungrouped.csv` hand-checked |
| CSV export | Grouped | pass | `out/grouped.csv` |
| CSV export | Quoting of commas, quotes, newlines | pass | `out/quoting.csv` |
| CSV export | Tauri save dialog | not tested | Browser build only |
| Save round trip | Browser download path | pass | `saved-browser.pdf`: no `/Measure`, by design (`downloadService.ts` skips the measure pass) |
| Save round trip | Emulated Tauri save pass writes `/Measure` and `/VP` | pass | RL, X/D/A formats and `/VP` verified in Node |
| Save round trip | Reopen saved output in the app | pass | `saved-measure.pdf`, scale and values restored |
| Save round trip | Ctrl+S "apply changes" | fail | Jumps to another open file, stale dirty flag, next open hung (bug 2) |
| Save round trip | Open another file after drawing | fail | Unsaved markups discarded silently (bug 1) |
| Save round trip | Output opened in Acrobat or Revu | not tested | Not installed here |
| Save round trip | Disk save, atomic write, save dialog | not tested | Tauri only |
| Save round trip | Windows user name as author | not tested | Browser build |
| General | Console errors | fail | Repeated "Encountered a script tag while rendering React component" (bug 18, probably pre-existing) |
| General | Dark mode | pass | |
| General | Narrow window (about 1000px) | pass | Falls into mobile layout, docks cramped (bug 19, observation) |
| General | No document open | pass | |
| General | Switching between two files | fail | Stale armed tool, lost markups (bugs 1 and 6) |
| General | 500 annotations load and list | pass | |
| General | Select one annotation on a 500-annotation page | fail | About 1.7 s main-thread block (bug 8) |
| General | Frame rate on 500 annotations | not tested | Pane hidden, rAF throttled |
| General | Label layer performance with 500 own markups | not tested | Test PDF annotations are foreign, so not labelled |
| General | Core ruler | not tested | Not reached |
| General | Exact Revu keys for wall height, depth and columns | not tested | No reference file |

Totals: 36 pass, 19 fail, 10 not tested (65 checks).

## Bugs, by severity

### High

1. Opening another file discards the previous file's unsaved markups with no prompt.
   - Repro: open `drawing-a3.pdf`, draw a Length, then load a second PDF through the sidebar file input (`.file-sidebar-inner input[type=file]`). Switch back.
   - Expected: markups kept, or a prompt about unsaved changes.
   - Actual: the first file's markups are gone.
   - Fix (2026-11-27): cause was not the file input but `HomePage`'s "files added while viewing" effect, which jumps the viewer to the newest file with `setWorkbench("viewer")` from `viewer`: no workbench change, so the unsaved-changes guard never ran. The jump now goes through `requestNavigation` (Save & Leave / Discard & Leave / Keep Working; Keep Working leaves the file open with its markups and the new file in the workbench). Covers the file input, drops and OS "open with". Core edit logged in `docs/core-patches.md`; verified in the dev server (draw, add a file: prompt appears, Keep Working keeps the markup, Save & Leave saves a version first).
   - Likely source: file replacement path in `core/contexts/FileContext.tsx` and `core/components/viewer/EmbedPdfViewer.tsx` (annotation state is not carried across file switches).

### Medium

2. Ctrl+S "apply changes" jumps the viewer to an unrelated open file.
   - Repro: with several files open, hover the viewer, draw a markup, press Ctrl+S.
   - Expected: stays on the file; the dirty flag clears.
   - Actual: the viewer jumps to `test-drawing.pdf`, the dirty flag stays set, and the next open hung at "Loading PDF Engine..." until the page was reloaded.
   - Fix (2026-11-27): `applyChanges` set the viewer's active id to the new version before `consumeFiles` had added it; `ViewerContext` clears an active id that is not in the workbench, so the viewer fell back to the first open file (reproduced: it landed on another file whenever the viewed file was not first). The id is now set after `consumeFiles` (three call sites in `EmbedPdfViewer.tsx`, as the form-fill path already did). Verified: Ctrl+S keeps the file, the dirty flag clears (no prompt on the next switch), later opens work. The "hung at Loading PDF Engine" follow-up was not reproduced separately; it came after the jump and is assumed to be a consequence of it.
   - Likely source: `core/components/viewer/EmbedPdfViewer.tsx` (`applyChanges`, around line 1181, which saves a new version via `saveAsCopy`).

3. User page scales are not persisted into the in-app saved version.
   - Repro: set a 1:100 m user scale, draw a Length, press Ctrl+S, reload the page and reopen the new version.
   - Expected: scale restored.
   - Actual: scale lost, labels and list switch to mm while Comments still say m, and wall height and depth show "3.00 mm".
   - Likely source: `studio/services/localFileSaveService.ts` (the `/VP` pass runs only in Tauri `saveToLocalPath`; the in-app version and `downloadService.ts` skip `ensureMeasureDictionaries`).
   - Fix (2026-11-27): the measure pass now runs on every export of the viewer's live document. `exportActions.saveAsCopy` calls a new core seam `finishViewerExport`; the studio shadow (`studio/services/viewerExportFinish.ts`) runs `ensureMeasureDictionaries` with the user scales of the active file (skipped when there is neither a user scale nor one of our markups). Verified: 1:100 m, draw, Ctrl+S, reload, the saved version shows 1:100 (m) and metre labels. Unit test added. Known gap: a scale change on a page with no markup does not mark the document changed, so Ctrl+S in the browser build does nothing for it; the Tauri Save always writes the scales to disk.

4. The colour picker popover in the Properties dock deselects the markup and does not apply the swatch.
   - Repro: select a markup, open the colour picker, click a swatch.
   - Expected: colour applied, selection kept.
   - Actual: markup deselected, colour unchanged.
   - Likely source: `core/components/viewer/AnnotationSelectionMenu.tsx` around line 141 (click-outside exempts only `.mantine-Popover-dropdown`; the colour dropdown is `.mantine-ColorInput-dropdown`).
   - Fix (2026-11-27): cause as suspected: the click-outside handler exempted only `.mantine-Popover-dropdown`, and the colour and select dropdowns are Mantine portals under `body`, outside the dock's `data-no-interaction`. It now ignores anything inside `[data-portal]` (`core/components/viewer/AnnotationSelectionMenu.tsx`, logged in `core-patches.md`). Verified in the browser: swatch click keeps the selection and applies the colour.

5. Enter does not finish polyline, curve or polygon drawing.
   - Repro: arm Polylength, click three points, press Enter.
   - Expected: shape finishes, as the panel hint says.
   - Actual: nothing happens; a double-click is needed.
   - Likely source: `finishPendingPageShape()` is wired only in core `core/tools/annotate/AnnotationPanel.tsx`; the studio measure panel and `ViewerPointerProviders.tsx` have no Enter handler.
   - Fix (2026-11-27): Enter was wired only in core's AnnotationPanel. `useMeasureToolInteraction` (new, mounted once through `MeasureLabelLayer`, reference counted) listens for a bare Enter while polylength, curve, area, wall or volume is armed and calls `finishPendingPageShape()`; fields, buttons and links keep their Enter, a length has nothing to finish. Esc already cancels the shape by disarming the tool (`useMarkupTools`), unchanged. Verified: three clicks plus Enter finish a polyline and a curve; logic in `measureToolKeys.test.ts`.

6. Stale armed-tool state after switching files.
   - Repro: arm Length, open another file via the sidebar.
   - Expected: tool state reset, or tool still draws.
   - Actual: UI store keeps `armedToolId: "measureLength"` (button pressed, "LENGTH DEFAULTS" shown) while `isMeasureToolArmed()` is false; a drag adds nothing.
   - Likely source: studio measure tool store and its reset on document change.
   - Fix (2026-11-27): the UI store mirrors the armed tool through plugin events, and a document switch destroys the plugin without one. `bindMarkupController` now re-reads the armed tool and the selection from the newly bound plugin (so a fresh document starts with no tool armed) and cancels a pending calibration when unbound. Verified: arm Length, open another file, button is not pressed. Unit tests added.

7. With a tool armed, pointer-down on an existing annotation selects it instead of drawing.
   - Repro: arm Length, drag starting on an existing markup.
   - Expected: a new line is drawn.
   - Actual: the existing markup is selected, nothing drawn.
   - Likely source: EmbedPDF annotation selection layer versus tool capture in `core/components/viewer/ViewerPointerProviders.tsx`.
   - Fix (2026-11-27): the plugin's annotation containers (`[data-no-interaction]` under `.pdf-page-pointer-layer`) take the pointer down and select or drag. While a measurement tool is armed the same hook sets `data-measure-tool-armed` on the root and `MarkupsDocks.css` turns pointer events off on everything inside those containers, so the page pointer layer draws. Side effect: with a tool armed, handles of the selected markup are inert; Esc, then drag, as in Revu. Verified: Length armed, drag from an existing line draws a new line and leaves the first one alone.

8. Selecting one annotation on a 500-annotation page blocks the main thread for about 1.7 s.
   - Repro: open `perf-500.pdf`, click one annotation, observe `longtask`.
   - Expected: responsive.
   - Actual: about 1.7 s long task. Not attributed to our code versus EmbedPDF.
   - Likely source: `markupSync.ts` or the Properties dock re-rendering on selection, or EmbedPDF itself.
   - Fix (2026-11-27): not fixed, it is not our code. Reproduced with `perf-500.pdf` by selecting one annotation through `selectMarkup` (about 2.0 s long task, only 2 ms of it synchronous). The same cost remained with the right dock closed and with `MeasureLabelLayer` returning null (about 1.8 s either way), so the Properties panel, label layer, Markups List (closed) and our store listeners are not the cause. What is left is React re-rendering all 500 `AnnotationContainer`s of EmbedPDF's `AnnotationLayer` (about 4 ms each, `isSelected` changes on a state change and each container resolves its tool by scoring every registered tool) plus core's page layers. Fixing it needs a change inside EmbedPDF's annotation layer (memoised containers); our additions did not measurably add to it.

9. Undo of a depth/height edit leaves `contents` stale.
   - Repro: change wall height or volume depth, press Ctrl+Z (viewer hovered).
   - Expected: value, label and `contents` revert together.
   - Actual: `contents` keeps the edited value.
   - Likely source: `studio/.../markupSync.ts` (writes `contents` outside history).
   - Fix (2026-11-27): cause: an undo event carries the pre-edit object plus only the keys the original edit patched, so `markupSync` rebuilt the annotation with the old `/Contents` and found nothing to fix while the state still held the edited one. It now reads the annotation from the plugin's state at event time, so undo and redo recompute `contents` (written with `syncAnnotationObject`, no extra undo step). Verified: wall height 3 to 5 gives 34.36 sq m, Ctrl+Z gives 20.62 sq m, Ctrl+Y 34.36 sq m; the same for a curve handle drag.

### Low

10. Undo of a scale change has no visible effect and wastes an undo step. The scale store is not in the history plugin (`pageScaleStore`).
    - Fix (2026-11-27): not fixed, decided and documented. A scale is a page setting, not an edit of a markup, so it stays outside the undo history; making it undoable would need either a history command that also rewrites `/Contents` (annotation commits only follow annotation edits) or a second undo step per change. What is made consistent: the markup text rewrite caused by a scale change is still one history step, and `markupSync` re-derives `/Contents` from the current scale when that step is undone or redone, so the comment, label and list never disagree with the scale (verified: after Ctrl+Z at 1:50 the comment still reads the 1:50 value). The only cost is the wasted step; to go back, set the previous scale again.
11. Opening a second file via the file input gives no feedback that markups were dropped (see bug 1).
    - Fix (2026-11-27): solved by the bug 1 fix: nothing is dropped without the Save / Discard / Keep working prompt, so no extra toast was added. Note found while testing: a layout switch (pane narrowed into the mobile layout) remounts the viewer and drops unsaved markups without a prompt; not in scope here.
12. Foreign measurements have no on-page label and no Measurement values in the panel, and their `contents` goes stale after a geometry edit while the list Length updates. `MeasureLabelLayer.tsx` labels only `isOwnMarkup`.
   - Fix (2026-11-27): the engine does not expose `/Measure`, so foreign measurements use the page scale (`/VP`). `MeasureLabelLayer` no longer filters on `isOwnMarkup`, so they get labels; the panel already shows Measurement values once `intent` is read (verified: Length 10.58 m on the Revu line). `contents` is rewritten for a foreign measurement only after a geometry edit here that changes the measured value (`rewriteForeignContents` in `computeMarkupPatch`, tracked per annotation in `markupSync`), so a moved line or a scale change keeps the author's text. Verified: dragging a vertex gives 7.57 m, undo gives 10.58 m again. Not covered: a foreign measurement with its own `/Measure` that differs from the page scale is measured on the page scale.
13. The curve tool shows about 134 dense vertex handles that obscure the line.
   - Fix (2026-11-27): the plugin offers a handle per sampled vertex. `MeasureLabelLayer` now emits a stylesheet that hides every `[data-epdf-vertex]` handle of the selected curve except those at the clicked points (`curveHandleIndices`). `markupSync` turns a vertex edit into a re-sampled spline (`applyCurveVertexEdit`): a dragged control-point handle updates that point and re-samples, a moved curve moves its points, an undo restores them; anything else drops `controlPoints` as before. Verified: a drawn curve shows 4 handles instead of 193, dragging one re-samples smoothly and undo restores. During the drag itself the preview shows a kink at the one moved sample until release.
14. The custom ratio field shows 100.0001 for a `/VP` factor of 0.0352778 (rounding in `core/utils/pdfMeasurementExtraction.ts` or the ratio display).
   - Fix (2026-11-27): the `/VP` factor is stored to six digits, so factor over point size gives 100.0001 and the field printed it to four decimals. `roundRatio` in `scalePresets.ts` snaps a ratio within 0.05% of a whole number (every preset is one) and otherwise rounds to two decimals; `findPreset` uses the same tolerance so the preset list also selects 1:100. `PageScaleSection.tsx` (other agent's file) changed only its `ratioToText` helper and one import. Verified: the foreign file shows 100 and preset 1:100.
15. The opacity slider can go to 0, leaving an invisible markup.
   - Fix (2026-11-27): the slider and `appearancePatch` now stop at `MIN_OPACITY` (10%). Verified in the browser (`aria-valuemin` 0.1) and in `propertyPatches.test.ts`.
16. The Total row in a mixed-unit list leaves Length and Area empty but sums Wall Area and Volume.
   - Fix (2026-11-27): `computeTotals` summed each numeric column over the rows that had a value, so Wall Area and Volume (only metre rows) added up while Length and Area (mixed) did not. Once the list's units differ no numeric column is summed; every column with values reads mixed. Unit-tested in `markupRows.test.ts`.
17. Shift-click on a Markups List row selects the row text.
   - Fix (2026-11-27): a Markups List row cancels the default of a Shift mouse-down, so the browser no longer extends a text selection across the rows; the range selection still works. Verified: shift-click selects 4 rows and `getSelection()` is empty.
18. Console: repeated "Encountered a script tag while rendering React component". Probably pre-existing, not attributed.
19. At about 1000px the app falls into the mobile layout and the docks are cramped.
20. One intermittent case: after Esc plus a double-click over an existing line, a polyline kept 7 vertices. Not reproducible.

## Not exercised

- Anything depending on Tauri: save dialog, CSV save dialog, atomic disk save, Windows author name.
- Acrobat or Revu opening our saved output.
- Calibration on a rotated page.
- Frame-rate and label-layer performance on 500 own markups.
- The core ruler.
- Exact Revu keys for wall height, depth and columns.

## Re-test (2026-11-27)

Scope: confirm or refute the fixes for bugs 1 to 17, sweep the first pass's passing checks for regressions, note new behaviours, check the console. Nothing was edited except this section; nothing was committed.

Environment: Vite dev server `http://localhost:5173` (browser build, not Tauri), Browser pane at 1600x900. IndexedDB and localStorage were cleared first. Test PDFs from the first pass (`drawing-a3.pdf`, `foreign-revu.pdf`, `perf-500.pdf`) were served from a throw-away local helper server that has been stopped. Not available in a browser build and therefore not tested: Tauri save dialog, disk save, CSV save dialog, Windows user name, Acrobat or Revu opening the output. Values were hand-checked against the page scale (A3 page at 73% zoom, 0.726 CSS px per pt; 1:100 m gives 0.0353 m per pt).

### Bug re-test

| Bug | Status | Evidence |
| --- | --- | --- |
| 1 Opening another file drops unsaved markups | Fixed | Drew 7 markups, added `foreign-revu.pdf` through the sidebar file input: "Unsaved Changes" dialog (Save & Leave, Keep Working, Discard & Leave). Keep Working: markups kept, new file added to the workbench. Save & Leave (later run): a new version of the file appeared first in the list with all markups; Discard & Leave also works. With no unsaved edits, adding a file jumps without a prompt. |
| 2 Ctrl+S jumps to another open file | Fixed | Three files open, viewing the second, Ctrl+S with the viewer hovered: stays on the saved version, new version listed, no prompt on the next add (dirty flag cleared), the next open (`perf-500.pdf`) loaded normally. The "hung at Loading PDF Engine" follow-up did not recur. |
| 3 Scale not persisted in in-app saved version | Fixed | 1:100 m, draw, Ctrl+S, reload page, open the saved version: "Page 1: 1:100 (m)", metre labels, list values and Comments unchanged, volume depth kept (Volume 15.11 cu m at depth 0.5 m). |
| 4 Colour picker deselects, swatch not applied | Fixed | Volume selected, opened the colour popover, clicked the blue swatch: stroke `#1e88e5` applied, selection and handles kept, list colour chip updated. |
| 5 Enter does not finish polyline, curve, polygon | Fixed | Polylength 3 clicks + Enter (15.55 m), Curve 4 clicks + Enter (19.70 m), Area 4 clicks + Enter (66.11 sq m), Wall 2 clicks + Enter, Volume 4 clicks + Enter; Esc then disarms. |
| 6 Stale armed tool after file switch | Fixed | Length armed (`aria-pressed` true, `data-measure-tool-armed` set), switched file: all six buttons `aria-pressed=false`, attribute gone. Arming Length on the new file and dragging draws (4.95 m, hand check 4.96). |
| 7 Armed tool, pointer-down on annotation selects it | Fixed | Length armed, dragged from the middle of an existing line: a new 7.77 m line was drawn, the first stayed unchanged. |
| 8 500-annotation selection delay | Not fixed, as documented | `perf-500.pdf`, one click on one annotation: one 2121 ms `longtask`. Unchanged from the first pass (about 1.7 s). |
| 9 Undo of depth/height edit leaves `contents` stale | Fixed | Volume depth 0.1 to 0.5: Comments, label, list and panel 3.02 to 15.11 cu m; Ctrl+Z: all four 3.02; Ctrl+Y: 15.11. Same for a curve handle drag (see 13). |
| 10 Undo of a scale change | Not fixed, as documented | Page 2 at 1/4" = 1'-0" then 1:50, Ctrl+Z: scale stays 1:50 and the markup stays consistent with it (4.86 m); Ctrl+Y: still consistent. The undo step is wasted, nothing breaks. |
| 11 No feedback when file open drops markups | Fixed (by bug 1) | Same dialog as bug 1. A layout switch still drops unsaved markups, see N1. |
| 12 Foreign measurements: no label, no values, stale `contents` | Fixed | `foreign-revu.pdf`: every foreign measurement has a page label (10.58 m, 14.11 m, 24.89 sq m); Properties shows Measurement "Length 10.58 m"; dragging the end of the line gives 8.16 m in panel, list and Comments with author "Alice Reviewer" kept; Ctrl+Z gives 10.58 m everywhere. |
| 13 Curve shows about 134 dense handles | Fixed | Curve shows 4 visible handles (164 `data-epdf-vertex` nodes exist, 4 visible). The curve also keeps its 4 handles after save and reopen. Dragging one handle re-samples smoothly, 19.70 to 24.81 m; Ctrl+Z restores 19.70 m and 4 handles. |
| 14 Custom ratio shows 100.0001 | Fixed | `foreign-revu.pdf` (`/VP` factor 0.0352778): "Page 1: 1:100 (m)", preset 1:100, custom field 100. |
| 15 Opacity slider reaches 0 | Fixed | `aria-valuemin` 0.1; Home key gives 10% (tooltip "10%"), the markup stays visible; End gives 100%. |
| 16 Mixed-unit Total row | Fixed | Page 1 in m, page 2 at 1/4" = 1'-0" (Length 15.30 ft): Total and the Length group subtotal show a dash in Length, Area, Wall Area and Volume. Back to one unit (1:50 m on page 2): sums return (Length group 22.35, hand check 9.72 + 7.77 + 4.86). |
| 17 Shift-click selects row text | Fixed | Click first row, Shift-click third: 3 rows selected, `getSelection()` is empty. Ctrl-click toggles as before. |
| 18 Console script-tag error | Unchanged | One "Encountered a script tag while rendering React component" per page load. |
| 19, 20 | Not retested | No cheap repro (19 needs a narrow window, and the pane width then changed by itself, see N1; 20 was not reproducible). |

Counts: 15 fixed (1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17), 2 not fixed as documented (8, 10), 0 partly fixed, 1 unchanged (18), 2 not retested (19, 20).

### Regression sweep

| Area | Check | Result | Evidence |
| --- | --- | --- | --- |
| Page scale | Preset 1:100 m | pass | Length 9.72 m for 275.6 pt (hand 9.72) |
| Page scale | Custom ratio | pass | 1:200 doubles lengths (19.44), 1:150 gives 14.58, 1:80 gives 0.8 times the 1:100 value |
| Page scale | Calibrate | pass | Two clicks 275.6 pt apart, dialog "Measured page distance 97.2 mm", 10 m entered: scale 1:102.9, the page 2 Length reads 10.00 m |
| Page scale | Imperial preset | pass | 1/4" = 1'-0" gives 15.30 ft (hand 15.31) |
| Page scale | Apply to all pages | pass | Both pages updated, see N2 for a selection side effect |
| Page scale | Foreign `/VP` on open | pass | "Page 1: 1:100 (m)" |
| Tools | Length, Polylength, Curve, Area, Wall, Volume values | pass | Length 9.72 and 7.77 m (hand 7.78); Polylength 9.72 + 5.83 = 15.55; Curve 19.70 (chord length 19.19, curve longer); Area 66.11 (hand 66.2); Wall 9.72 x 3 = 29.16; Volume: area 30.22 x depth 0.1 = 3.02 |
| Tools | Esc disarms and cancels | pass | |
| Properties | Subject, comments, line width, colour, depth | pass | List regrouped to "Slab A", comments appended, width field 6 applied |
| Properties | Undo and redo | pass | Depth edit undo and redo, curve handle undo, foreign geometry undo |
| Geometry | Move a whole markup | pass | Length moved, value 9.72 m kept |
| Geometry | Vertex drag updates value | pass | Foreign line 10.58 to 8.16 m |
| Markups List | Grouping, subtotals, totals | pass | Length total 62.46 = 19.70 + 17.49 + 15.55 + 9.72 (wall length counts); Area 96.34 (rounding) |
| Markups List | Sort, filter, column chooser, reorder | pass | Descending sort inside groups; "wall" filter; Label added, Author moved up |
| Markups List | Row click, multi-select | pass | Click, Ctrl-click, Shift-click |
| Markups List | Status edit | pass | "Accepted" on the Wall row |
| Markups List | Hide and show | pass | Row greyed and label removed, then restored |
| CSV | Content | pass | Captured through the browser blob path: header "Row type" then the visible columns in the reordered order, Subtotal and Total rows, values at the current scale (7.77 at 1:80) |
| Save | In-app save then reload | pass | See bug 3 |
| Files | Switching between two open files | pass | Docks, scale and values follow the file |
| General | Dark mode | pass | Only dark was exercised; a light scheme forced by attribute is not a supported path, so light mode is not tested |
| General | Console | see below | |

### New behaviours worth knowing

- Adding a file while viewing now asks "Unsaved Changes ... Are you sure you want to leave?" when the viewed file is dirty. It also appears after edits that were undone back to the original (the file stays dirty), and the wording suggests leaving although the user only added a file. Not a bug, but it can surprise.
- With a measurement tool armed, existing markups ignore the pointer and handles of the selected markup are inert: dragging a handle of the selected line draws a new line from there (confirmed, a 7.13 m line). Esc, then drag, edits.
- Curve control-point handles: 4 handles for a 4-point curve, dragging re-samples; during the drag a kink is visible until release (per the fix note).
- Opacity minimum 10%; a file already carrying `CA 0` was not tested.
- Foreign measurements are now labelled. On `perf-500.pdf` this paints 500 labels that overlap into a solid red mass at fit width.
- Scale-only changes (no markup edit) do not mark the file dirty, so Save & Leave or Ctrl+S do not persist them, as the plan says.

### New bugs

Medium

N1. A layout change (the pane width changed by itself during testing, which switches the app between desktop and mobile layout) remounts the viewer and silently drops unsaved markups and edits, and leaves state inconsistent. This is the known note under bug 11, now reproduced with consequences.
- Repro: open `drawing-a3.pdf`, 1:100 m, draw Length, Polylength, Curve, Area, Wall and Volume, edit one, add a Length on page 2, set the scale to 1:80 on page 1 with "Apply to all pages" ticked, set a status. Make the pane narrower than the desktop breakpoint, then widen it again (or let the pane resize).
- Expected: markups kept, or the unsaved-changes prompt.
- Actual: the page 2 Length and the status are gone (7 markups instead of 8), no prompt. The in-memory page scale store kept 1:80, so the list shows 42.31 for the Area and 7.77 for a 9.72 m line while Comments still read "66.11 sq m" and "9.72 m": values and Comments disagree until the scale is set again (setting 1:100 restored them).
- Likely files: `core/components/viewer/EmbedPdfViewer.tsx` (viewer remount on layout switch), `studio/services/markups/pageScaleStore.ts` (scale kept while the document is rebuilt).
- Fix (2026-11-27): the cause was `HomePage` rendering `<Workbench />` in three different parents (mobile files hub, mobile slide, desktop panel group), so a breakpoint switch unmounted the viewer and with it the EmbedPDF store holding the unsaved edits. Fixed at the root, not with a guard: `core/components/layout/PersistentWorkbench.tsx` renders the one `Workbench` through a React portal into a detached `display: contents` host element, and each layout renders a `WorkbenchSlot` that adopts the host in a layout effect (before paint). The viewer is never unmounted, so annotations, selection, undo history and the page scale store stay consistent. Reloading from an older version (the alternative) was rejected because it would still lose edits. Core edits are logged in `docs/core-patches.md`.
- Verified: `PersistentWorkbench.test.tsx` (one mount, zero unmounts, state kept across a mobile and desktop switch). In the browser: drew the six tools, edited one, added a Length on page 2, set 1:80 for all pages, set a status, then crossed the 1024 px breakpoint twice (1600 to 800 to 1600). All 8 markups and the status stayed, and Comments and list values stayed in step, with no prompt.
- Left: scroll position after the round trip is decided by the viewer's refit (it can land on page 1). An older gap remains: after Discard & Leave of a change that came from a scale edit, the in-memory scale store keeps the new scale while the markups are discarded (nothing calls `forgetFileScales`), so Comments and list values can disagree until the scale is set again. In dev, editing `PersistentWorkbench.tsx` causes a full reload on HMR (mixed hook and component exports); a build is not affected.

Low

N2. Ticking "Apply to all pages" moves the selection to an unrelated markup.
- Repro: `drawing-a3.pdf`, page 1 at 1:100 and page 2 at another scale (set 1:80 with the box unticked), select the Length on page 2, tick "Apply to all pages".
- Expected: selection stays on the page 2 Length.
- Actual: the Volume on page 1 becomes selected and the dock title switches to "Page 1". It did not happen when all pages already had the same scale, or for a preset or custom Set with the box already ticked.
- Likely files: `studio/components/viewer/markups/PageScaleSection.tsx`, `studio/services/markups/markupController.ts` (batch update path through `updateMarkups` and `setScaleForPages`).
- Fix (2026-11-27): the cause was `AnnotationMenuEvents` (core), which selects the annotation of every committed `update` so its menu opens. The scale subscription in `markupSync` rewrites the measurement contents of the other pages' markups, and the commit of one of those got selected. New seam `core/components/viewer/annotationMenuSuppression.ts` (`suppressMenuSelection` / `consumeMenuSuppression`): one mark per annotation id, consumed by its first committed update, expiring after 5 s so a commit that never arrives cannot swallow a later edit. `markupSync` marks the patched ids just before `updateAnnotations` in the scale-change path; direct edits, undo and redo still select as before. Chosen over filtering by event source because the plugin's committed event carries no origin.
- Verified: `annotationMenuSuppression.test.ts` and `markupSync.test.ts` (patched ids are marked; nothing is marked when no markup needs rewriting). In the browser the repro keeps the page 2 Length selected and the "Page 2" dock title, and a real edit afterwards still opens the menu.

N3. Editing a foreign `LineDimension` through the Properties panel regenerates its appearance with large arrowheads at both ends.
- Repro: `foreign-revu.pdf`, select "Beam length", set line width 2 to 3 (or change opacity).
- Expected: line style unchanged.
- Actual: a double arrow appears. Own Length lines do not get arrowheads when edited. Probably the engine's default line endings for a `/Line` without `/LE`; not attributed to our code.
- Likely files: `studio/services/markups/propertyPatches.ts` (the patch), EmbedPDF line appearance regeneration.
- Fix (2026-11-27): none needed in our code; documented only. The test file's `/Line` annotations have no `/LE` entry. A width or opacity edit makes PDFium regenerate the appearance stream, and a `/Line` without `/LE` regenerates with default line endings (arrowheads), whereas the original appearance had none. `propertyPatches.ts` does not touch line endings (the patch carries only the changed keys). Confirmed with a copy of the file where the lines carry an explicit `/LE [/None /None]`: the same width edit keeps the style. Revu and Bluebeam output writes `/LE`, so this is a property of the hand-built test file. If a real file without `/LE` ever shows up, the cheap guard is to write `/LE [/None /None]` when the patch regenerates a `/Line` that has none; not done because no real file needs it.

N4. Console: about 430 "Failed to load resource: net::ERR_FILE_NOT_FOUND" errors in a session (about 394 still buffered after a reload), none tied to a UI action in a quick check (a plain file switch added none). Probably stale blob or file URLs for stored thumbnails; the first pass did not log them. Origin not identified, not attributed to the markup work.
- Fix (2026-11-27): the cause is upstream EmbedPDF 2.15.1 (`@embedpdf/plugin-annotation`, `AppearanceImage`): it revokes the blob URL of its `<img>` in an effect cleanup and again in the `load` handler while the browser may still be fetching it, so appearance re-renders (scroll, zoom, selection) produced `net::ERR_FILE_NOT_FOUND` and broken-image flashes. Not our code, but cheap and safe: the existing in-memory patch plugin (`scripts/embedpdfEnginesPatch.mts`, `PATCH_REVISION` 7, version pinned to 2.15.1 and failing loudly on a mismatch) now defers the revoke of a retired URL by 10 s and drops the load-handler revoke. Chosen over leaving it because the flood buried real console output.
- Verified: `embedpdfEnginesPatch.test.ts` (patched react and preact builds, entry returns null). In the browser the same load, scroll, zoom and select sequence on `perf-500.pdf` gave 464 errors and broken images before and 0 of both after, measured against a console baseline because the pane keeps a 500-message buffer.

### Console

- 1 "Encountered a script tag while rendering React component" per page load (bug 18, unchanged).
- The `ERR_FILE_NOT_FOUND` flood above (N4).
- No uncaught exceptions, no React key or state warnings, no errors tied to drawing, editing, saving, undo or the list.

### Cleanup

No tabs were opened (only the pane's seed tab was used). Viewport emulation reset to desktop. The helper server on port 8765 was stopped. The dev server on port 5173 is still running. The app's IndexedDB and localStorage contain the test files from this run.
