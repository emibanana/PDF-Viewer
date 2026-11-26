# PDF Viewer: feature plan and status

A local-only Windows desktop PDF viewer and markup tool, forked from [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) (upstream `594a564`, v3.5.0). **No accounts, no login, no backend, no online services.** The app is built and running; this document tracks what is done and what to build next.

| Icon | Meaning |
|---|---|
| ✅ | Done and checked |
| 🟡 | In progress, or built but not yet checked end to end |
| ⬜ | Not started |
| 🔴 | Blocked (needs a decision or something from you) |
| ⏸️ | Deferred on purpose (see Deferred) |
| ⚠️ | Done with a known caveat (written beside it) |

---

## 1. Tech stack (brief)

| Layer | What we use |
|---|---|
| Shell | Tauri 2 (Rust). Small host in `frontend/src-tauri`: window, single-instance file forwarding, atomic save. No Java, no JRE, no server |
| UI | React 19, Mantine 8, Vite 7. Upstream editor UI (`src/editor/core`, MIT) plus our own layer `src/editor/studio` |
| PDF engine | EmbedPDF 2.15 (PDFium compiled to WASM): render, search, annotations, page ops. `@cantoo/pdf-lib` for writing PDFs, `pdfjs-dist` for text extraction |
| Build modes | `vite --mode studio`: `@editor/*` resolves `studio/` first, then `core/`. A file in `studio/` with the same path as a core file replaces it, so upstream merges stay small |
| Installer | NSIS, per-user, no admin (`installMode: currentUser`) |
| Branding | One master logo `studio/assets/brand/mark.svg` + `brand.json`; `python scripts/studio/gen-brand.py` regenerates every logo and icon |

**Licence boundary.** Only `src/editor/core`, `src-tauri` and `app/core` are MIT. `desktop/`, `proprietary/`, `cloud/`, `saas/`, `processor/` and `engine/` carry the restrictive Stirling licence: never copy or port code from them. A Vite plugin fails the build if the studio bundle imports any of them. (Engineering reading, not legal advice: get it confirmed before distributing outside your own use.)

**Run it** (PowerShell, from `frontend/`):

```powershell
. ..\dev-env.ps1      # puts rustup + the no-admin MSVC toolchain on PATH
npx tauri dev         # builds the Rust host and opens the app
```

---

## 2. Feature list and status

### Foundation

| | Feature | Notes |
|---|---|---|
| ✅ | Native Windows app that launches | `npx tauri dev` |
| ✅ | Local only: no login or account UI | Avatar replaced by a Settings gear; third-party keys blanked in `.env.studio` |
| ✅ | Rebrand to PDF Viewer | Name, icons, installer id, locale strings, single master logo |
| ✅ | Licence guard | Build fails on any import from a restricted directory. ⬜ CI step still to add |
| ✅ | Open a PDF from disk | Verified: launching `pdf-viewer.exe file.pdf` while the app runs opens it. ⚠️ Open dialog and drag-drop written, not clicked through yet |
| ✅ | Save in place (always overwrite) | Verified: temp file + rename in Rust, no leftover temp file. ⚠️ The "Save as" dialog for a never-saved file is not exercised yet |
| ✅ | Tools that need the Java backend deleted | Page, hooks, settings, tooltips, registry entry, route and id are gone from the code; listed under Deferred. ⚠️ Four keep only their operation hooks (OCR, Convert, Repair, Certificate Sign) because the text editor, create-PDF, damaged-file repair and signing still call them |
| ✅ | Automate removed | Rail entry, tool and start-up option deleted |
| 🟡 | File Library removed | Rail entry and the sidebar's "browse all" buttons are gone. ⬜ The library page code (`components/filesPage`, `FileManager`, the `myFiles` view) is still in `core/` and still has to be cut out |
| ✅ | Rail logo button removed | It had no purpose |
| 🟡 | Per-user NSIS installer | Configured; `tauri build` not run yet |
| ✅ | GitHub fork pushed | `origin` = emibanana/PDF-Viewer; `main` tracks upstream, `studio` is ours |

### Tools that work today (no backend)

✅ Read (viewer) · ✅ Multi Tool (page editor) · ✅ Annotate · ✅ Sign (draw/type/image) · ✅ Add Text · ✅ Add Image · ✅ Compare · ✅ Remove Annotations · ✅ Adjust Colors/Contrast · ✅ PDF Text Editor (⚠️ its OCR button needs a backend) · ✅ Form Fill (⚠️ creating new fields needs a backend) · ✅ Redact (⚠️ manual mode only; auto-redact needs a backend)

### Tools ported to run in the app

Re-implemented with `@cantoo/pdf-lib` as shadow hooks in `studio/hooks/tools/` and processors in `studio/services/pdfEdit/` (39 unit tests: `npx vitest run --project studio`). A tool returns to the menu when its id leaves `PORT_PLANNED_TOOL_IDS`.

| | Tool | Notes |
|---|---|---|
| ✅ | Merge | Also run inside the real app window (two 3-page PDFs gave 6 pages). ⚠️ Source bookmarks and fillable form fields are not carried over |
| ✅ | Rotate, Remove Pages, Extract Pages, Change Metadata | Unit tested |
| ✅ | Reorganize Pages (all 11 modes) | ⚠️ Booklet and side-stitch orders written from the UI descriptions, not compared with the Java output |
| ✅ | Add Password, Remove Password, Change Permissions | ⚠️ Only round-tripped with pdf-lib; open an output in a real viewer to confirm |
| 🟡 | Flatten | Forms-only mode works; the default whole-page-to-image mode is not built, so the tool stays hidden |
| ⬜ | Split | Page-based modes first; chapters via bookmarks |
| ⬜ | Show JavaScript, Edit Table of Contents, Manage Attachments | PDFium engine calls |
| ⬜ | Crop, Watermark, Add Page Numbers, Sanitize, Get Info | pdf-lib |

### Annotate: Add Text (text box)

| | Feature | Design notes |
|---|---|---|
| ✅ | Font, size and colour per box | Floating menu on the selected box: font list, size − / number / +, text colour, background colour |
| ✅ | Text box survives save, kill, reopen | Verified end to end: saved in place, process killed, file reopened, text present |
| ✅ | Looks the same in Edge / Chrome / other viewers | Root causes: wrong font id written by the engine (Courier) and an empty stored appearance. Fixed by a real appearance stream added on save (`pdfEdit/freeTextAppearance.ts`, 7 tests). Checked by rendering the saved file with PDFium (Chrome's engine) |
| ✅ | Standard fonts render in the viewer | The viewer's PDFium has no built-in Helvetica/Times/Courier and loaded them from a backend route we do not have, so non-embedded standard-font text was invisible. Liberation and DejaVu fallback fonts are now served from `public/fonts` |
| ✅ | Ctrl+S saves in place | Same Save as the toolbar button; commits a text box that is still being typed first. Verified: typed text, Ctrl+S, no prompt, text on disk |
| ✅ | Fallback fonts come from Windows | Rust serves the installed Arial, Times New Roman, Courier New, Verdana, Segoe UI and CJK fonts to the engine (`sysfont://`, `commands/fonts.rs`); bundled Liberation/DejaVu are the backup. Verified: Times, Courier and Japanese/Chinese text render |
| ✅ | Author is the Windows user | New annotations store the signed-in Windows user name instead of "Digital Signature" |
| ⚠️ | Boxes saved before the fix keep Courier | The wrong font was written into the file; pick the font in the box's menu and save to correct one |
| ⬜ | Non-Latin text in a text box | Stored text is right but the appearance draws "?" for characters outside Western text. Needs `@pdf-lib/fontkit` (new dependency, MIT) to embed a Windows font |
| ⬜ | Pick any installed font for a new box | Same embedding work as above |

### Desktop shell

| | Feature | Design notes |
|---|---|---|
| ✅ | New window per launched file | Double-click / "Open with" opens the PDF in its own window; each window has its own file queue |
| ⬜ | Window title = file name + dot when unsaved; focus the window if the file is already open | Single-instance handler currently always opens a new window |
| ⬜ | Open-file switcher | Rust window registry; file strip in the title bar; Ctrl+Tab recent-files switcher with thumbnails; Ctrl+P "go to file" |
| ⬜ | Taskbar integration | One AppUserModelID; thumbnail-toolbar buttons (Save, Print, Prev, Next, Close); overlay badge for unsaved; progress; Jump List |
| ⬜ | Unsaved-changes handling | Ignore our own writes in the file watcher; silent reload when clean; our version wins when dirty; prompt on close only if unsaved |
| ⬜ | Right-click menu and file association (per-user, no admin) | `HKCU` shell verbs, ProgID, PDF thumbnail handler (crate exists in `src-tauri/thumbnail-handler`); Integrations settings page |
| ⏸️ | Windows 11 top-level context menu | Needs a signed sparse package and an elevation helper; later |

### Search panel (Bluebeam-style)

| | Feature |
|---|---|
| ⬜ | Left-dock panel: scope = this file / all open files / a folder |
| ⬜ | Options: match case, whole word, regex, wildcards (`*` `?`), boolean (AND, OR, NOT, phrases) |
| ⬜ | Results tree File > Page > hit with snippet; click jumps and flashes the hit |
| ⬜ | Bulk actions on checked hits: highlight, underline, strikeout, redact, copy, export CSV |
| ⬜ | "N pages have no text" banner (OCR is deferred, so informational only) |

Notes: EmbedPDF already returns match context and case/whole-word flags, so the basic list is UI work; regex and boolean need a per-document text index built in a worker.

### Organize pages (Adobe-style)

| | Feature |
|---|---|
| ⬜ | Continuous thumbnail grid with file groups; collapse a file to one stacked card; zoom slider |
| ⬜ | Selection: click, shift/ctrl range, rubber-band, odd/even/range |
| ⬜ | Toolbar: rotate, delete, extract, insert (blank, from file, clipboard image), replace, duplicate, split, move to file, undo/redo |
| ⬜ | Drag and drop at an insertion caret: PDFs spliced in, images become pages (async placeholder tile so converters can plug in later) |

### Markup Studio (Bluebeam-like)

Foundation first: a typed markup model above EmbedPDF (subject, label, layer, status, colours, measurement, custom columns), a Properties panel and a Tool Chest of saved tool presets. Non-standard keys are written in a save-time pdf-lib pass.

| | Step | Markups |
|---|---|---|
| ⬜ | M0 | Markup model, Properties panel, Tool Chest, copy/paste markups between files |
| ⬜ | M1 Text | Rich-text box, typewriter, callout with changeable leader (our own appearance stream; riskiest, do first) |
| ⬜ | M2 Lines | Arrow and line-end types, polyline, polygon, curve/arc, dimension line |
| ⬜ | M3 Cloud | Rectangle, polygon and ellipse clouds, Cloud+ (cloud with callout) |
| ⬜ | M4 Image | Insert image with border, transparency, crop, replace |
| ⬜ | M5 Measure | Calibrate scale, length, polylength, area, perimeter, count, angle, radius, volume |
| ⬜ | M6 Workflow | Layers, status and replies, lock, flatten, align/distribute, group, custom stamps, hyperlinks |

### Markups List (Bluebeam-compatible)

| | Feature |
|---|---|
| ⬜ | Read every markup plus raw dictionary keys (Bluebeam custom columns, subject, status, layer, measurement) |
| ⬜ | Grid: multi-level grouping, sort, filter, subtotals and grand total, show/hide/reorder columns, saved views |
| ⬜ | Inline edit writes back to the markup; row click jumps to it; bulk set status/layer/colour |
| ⬜ | Custom columns (text, number, date, choice, yes/no, formula) |
| ⬜ | Export CSV, XLSX, summary PDF; option to match Revu's Markup Summary layout |
| ⬜ | Compatibility corpus: 15 to 20 real Revu PDFs plus their Markup Summary CSVs (kept out of the public repo) as the acceptance test |

### Performance

| | Feature |
|---|---|
| ⬜ | Profile first (WASM raster time vs React re-renders vs tile churn) |
| ⬜ | Zoom without the flash: keep old tiles, CSS-scale, coalesce wheel steps |
| ⬜ | Raw binary IPC for file bytes (save already does this) |
| ⬜ | Native PDF crate (`pdfium-render`) for folder-wide search and large merges |

---

## 3. Deferred

These tools need something this build does not ship (the Java backend, OCR, Office, a certificate store). Their code is **deleted**, not hidden, so the app carries no dead weight. Each line says what it would take to build them again.

| | Tool(s) | Why deferred |
|---|---|---|
| ⏸️ | OCR / Cleanup scans, Auto Rotate, Detect and Split Scanned Photos | Need OCR or computer vision. Planned route: Windows built-in OCR from Rust |
| ⏸️ | Compress | Needs a real image/stream optimiser (Ghostscript is AGPL, so not bundled) |
| ⏸️ | Convert (all), Repair | Office, PDF/A, HTML, epub and similar need Office, LibreOffice or a server. PDF to image and image to PDF can be rebuilt client-side |
| ⏸️ | Word/Excel/PowerPoint to PDF and back, PDF/A conversion and validation | Planned route: installed MS Office via COM, LibreOffice fallback |
| ⏸️ | Certificate Sign, Remove Certificate Sign, Timestamp, Validate Signature | Need the Windows certificate store / CMS signing. Planned: Rust cert store + PKI.js |
| ⏸️ | Check Accessibility, Auto Form Detection, Classify, Auto Rename | Need native analysis or an AI model |
| ⏸️ | Page size/scale, Multi-Page Layout, Booklet, PDF to Single Page, Overlay PDFs, Remove Blank Pages, Remove Images, Replace Color, Add Stamp, Unlock Forms, Create Portfolio, Extract Images | Medium pdf-lib/pdfjs ports; not scheduled yet |
| ⏸️ | Developer link tools (API, folder scanning, SSO, air-gapped) | Opened Stirling's online docs or the backend API |

### Removed for good (not coming back)

Automate (batch pipelines), the File Library page, the logo button on the rail.

### Leftovers to clean up

| | What | Notes |
|---|---|---|
| ⬜ | File Library page code | `core/components/filesPage`, `FileManager`, the `myFiles` workbench view, `/files` route |
| ⬜ | Per-tool automation plumbing | `*AutomationSettings` components, `automationSettings` registry field, `constants/automation.ts`, automation services |
| ⬜ | Features that call the server | Signing sessions and workspace, text-editor OCR, create-PDF, damaged-file repair; then delete the four operation-only hooks |
| ⬜ | Accessibility review inside the text editor | Inert (flag off), entry points removed; internals remain |
| ⬜ | Translation strings of removed tools | In `public/locales/*/translation.toml` |

---|---|---|
| ⏸️ | OCR / Cleanup scans, Auto Rotate, Detect and Split Scanned Photos | Need OCR or computer vision. Planned route: Windows built-in OCR from Rust |
| ⏸️ | Compress | Needs a real image/stream optimiser (Ghostscript is AGPL, so not bundled) |
| ⏸️ | Convert (all), Repair | Office, PDF/A, HTML, epub and similar need Office, LibreOffice or a server. PDF to image and image to PDF can be revived client-side |
| ⏸️ | Word/Excel/PowerPoint to PDF and back, PDF/A conversion and validation | Planned route: installed MS Office via COM, LibreOffice fallback |
| ⏸️ | Certificate Sign, Remove Certificate Sign, Timestamp, Validate Signature | Need the Windows certificate store / CMS signing. Planned: Rust cert store + PKI.js |
| ⏸️ | Check Accessibility, Auto Form Detection, Classify, Auto Rename | Need native analysis or an AI model |
| ⏸️ | Page size/scale, Multi-Page Layout, Booklet, PDF to Single Page, Overlay PDFs, Remove Blank Pages, Remove Images, Replace Color, Add Stamp, Unlock Forms, Create Portfolio, Extract Images | Medium pdf-lib/pdfjs ports; not scheduled yet |
| ⏸️ | Automate (batch pipelines) | Each step needs a tool endpoint; revisit once more tools run in-app |
| ⏸️ | Developer link tools (API, folder scanning, SSO, air-gapped) | Open Stirling's online docs or the backend API |

---

## 4. Repo and upstream

- Git remotes: `upstream` = Stirling-Tools/Stirling-PDF; `origin` = your fork (add it with `git remote add origin <url>`).
- Branches: `main` mirrors upstream (never commit to it); `studio` is the product branch. Merge upstream into `studio` roughly monthly.
- Our code lives in `frontend/src/editor/studio/` (UI layer), `frontend/src-tauri/` (Rust host), `frontend/scripts/studio/` (brand and locale tools). Edits to upstream `core/` are kept to a minimum and listed in `docs/core-patches.md` when they happen.
- A fork of a public repo stays public: never commit anything confidential (the Revu corpus goes in `corpus/`, which is git-ignored).
- Releases: build on a Windows machine or GitHub Actions `windows-latest`; unsigned for internal use, a code-signing certificate before wide distribution.

## 5. Risks and open questions

1. Licence reading (section 1): confirm before distributing outside your own use.
2. Rich-text FreeText appearance streams (Markup M1) are the hardest technical item: spike first.
3. Bluebeam's custom-column storage is undocumented; compatibility depends on the Revu sample corpus you provide.
4. Memory with many windows (one WebView2 per file): measure when the window-per-file feature lands; offer a tabs mode if needed.
5. Dev PC has no admin: Rust and MSVC are per-user (`%USERPROFILE%\tools\msvc`); a global MSVC install would only simplify setup.
