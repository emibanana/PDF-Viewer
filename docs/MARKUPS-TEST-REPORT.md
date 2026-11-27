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
   - Likely source: file replacement path in `core/contexts/FileContext.tsx` and `core/components/viewer/EmbedPdfViewer.tsx` (annotation state is not carried across file switches).

### Medium

2. Ctrl+S "apply changes" jumps the viewer to an unrelated open file.
   - Repro: with several files open, hover the viewer, draw a markup, press Ctrl+S.
   - Expected: stays on the file; the dirty flag clears.
   - Actual: the viewer jumps to `test-drawing.pdf`, the dirty flag stays set, and the next open hung at "Loading PDF Engine..." until the page was reloaded.
   - Likely source: `core/components/viewer/EmbedPdfViewer.tsx` (`applyChanges`, around line 1181, which saves a new version via `saveAsCopy`).

3. User page scales are not persisted into the in-app saved version.
   - Repro: set a 1:100 m user scale, draw a Length, press Ctrl+S, reload the page and reopen the new version.
   - Expected: scale restored.
   - Actual: scale lost, labels and list switch to mm while Comments still say m, and wall height and depth show "3.00 mm".
   - Likely source: `studio/services/localFileSaveService.ts` (the `/VP` pass runs only in Tauri `saveToLocalPath`; the in-app version and `downloadService.ts` skip `ensureMeasureDictionaries`).

4. The colour picker popover in the Properties dock deselects the markup and does not apply the swatch.
   - Repro: select a markup, open the colour picker, click a swatch.
   - Expected: colour applied, selection kept.
   - Actual: markup deselected, colour unchanged.
   - Likely source: `core/components/viewer/AnnotationSelectionMenu.tsx` around line 141 (click-outside exempts only `.mantine-Popover-dropdown`; the colour dropdown is `.mantine-ColorInput-dropdown`).

5. Enter does not finish polyline, curve or polygon drawing.
   - Repro: arm Polylength, click three points, press Enter.
   - Expected: shape finishes, as the panel hint says.
   - Actual: nothing happens; a double-click is needed.
   - Likely source: `finishPendingPageShape()` is wired only in core `core/tools/annotate/AnnotationPanel.tsx`; the studio measure panel and `ViewerPointerProviders.tsx` have no Enter handler.

6. Stale armed-tool state after switching files.
   - Repro: arm Length, open another file via the sidebar.
   - Expected: tool state reset, or tool still draws.
   - Actual: UI store keeps `armedToolId: "measureLength"` (button pressed, "LENGTH DEFAULTS" shown) while `isMeasureToolArmed()` is false; a drag adds nothing.
   - Likely source: studio measure tool store and its reset on document change.

7. With a tool armed, pointer-down on an existing annotation selects it instead of drawing.
   - Repro: arm Length, drag starting on an existing markup.
   - Expected: a new line is drawn.
   - Actual: the existing markup is selected, nothing drawn.
   - Likely source: EmbedPDF annotation selection layer versus tool capture in `core/components/viewer/ViewerPointerProviders.tsx`.

8. Selecting one annotation on a 500-annotation page blocks the main thread for about 1.7 s.
   - Repro: open `perf-500.pdf`, click one annotation, observe `longtask`.
   - Expected: responsive.
   - Actual: about 1.7 s long task. Not attributed to our code versus EmbedPDF.
   - Likely source: `markupSync.ts` or the Properties dock re-rendering on selection, or EmbedPDF itself.

9. Undo of a depth/height edit leaves `contents` stale.
   - Repro: change wall height or volume depth, press Ctrl+Z (viewer hovered).
   - Expected: value, label and `contents` revert together.
   - Actual: `contents` keeps the edited value.
   - Likely source: `studio/.../markupSync.ts` (writes `contents` outside history).

### Low

10. Undo of a scale change has no visible effect and wastes an undo step. The scale store is not in the history plugin (`pageScaleStore`).
11. Opening a second file via the file input gives no feedback that markups were dropped (see bug 1).
12. Foreign measurements have no on-page label and no Measurement values in the panel, and their `contents` goes stale after a geometry edit while the list Length updates. `MeasureLabelLayer.tsx` labels only `isOwnMarkup`.
13. The curve tool shows about 134 dense vertex handles that obscure the line.
14. The custom ratio field shows 100.0001 for a `/VP` factor of 0.0352778 (rounding in `core/utils/pdfMeasurementExtraction.ts` or the ratio display).
15. The opacity slider can go to 0, leaving an invisible markup.
16. The Total row in a mixed-unit list leaves Length and Area empty but sums Wall Area and Volume.
17. Shift-click on a Markups List row selects the row text.
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
