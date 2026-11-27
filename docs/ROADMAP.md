# Roadmap: a free Bluebeam + Acrobat for Windows

PDF Viewer aims to be one free, open-source Windows app that covers the two paid tools most professionals juggle:

- **Bluebeam Revu** for markup, measurement and drawing review (architecture, engineering, construction).
- **Adobe Acrobat Pro** for editing, organising, converting and securing PDFs.

This document maps their best-known features onto our app, says what we already have, and groups the rest into phases. Day-to-day status of individual items lives in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md); this file is the direction.

| Mark | Meaning                                               |
| ---- | ----------------------------------------------------- |
| ✅   | In the app today                                      |
| 🟡   | Partly there (the note says what is missing)          |
| P1…P6 | Planned, in that phase (see [Phases](#phases))       |
| ➖   | Not planned (the note says why)                       |

Competitor features are taken from the public feature lists of Bluebeam Revu 21 (Complete) and Adobe Acrobat Pro as of late 2026. We are not affiliated with either company; their names are used only to describe compatibility and coverage.

---

## What "snappy" means here

Revu feels fast because it never makes you wait or hunt: one key picks a tool, the tool stays armed, properties change live, and a 200-sheet drawing set scrolls like a web page. Those are product requirements for us, not polish for later.

| Principle | Target |
| --- | --- |
| Open to first sharp page | Under 0.5 s for a typical PDF on the production build |
| Zoom and pan | No blank flashes, 60 fps on large-format vector sheets |
| Tool switching | Single-key shortcuts; switching never opens a dialog |
| Repeat work | Tools stay armed (tool lock); last-used style is remembered per tool |
| Editing a markup | Properties panel edits apply live, no OK button |
| Saving | Ctrl+S overwrites in place, atomically, with no prompt |
| Footprint | One small native host (Tauri), no Java, no server, no account |

Every phase below has to keep these budgets. A feature that makes the viewer slower is not done.

---

## Feature map

### Viewing and navigation

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| Fast rendering, flash-free zoom, Ctrl+wheel anchored on the pointer | Both | ✅ | PDFium (WASM) with tile reuse while zooming |
| Thumbnails, bookmarks, attachments, comments panels | Both | ✅ | Docked in the left panel |
| Find text in the document | Both | ✅ | Find and replace panel |
| Open many files: window per file | Both | 🟡 | Window per file works; switcher and Ctrl+Tab are P1 |
| Search panel: all open files or a folder, regex, wildcards, boolean, results tree | Revu | P1 | Design in IMPLEMENTATION-PLAN "Search panel" |
| Bulk markup from search hits (highlight, strike, redact) | Revu | P1 | Same panel |
| Print | Both | 🟡 | Uses WebView2 print; verify and harden in P1 |
| Split view and synced scroll between two documents | Revu | P3 | For sheet-to-sheet review |
| Snapshot a region to clipboard or as an image markup | Both | P3 | |
| Page labels (A-101, S-201) shown and editable | Both | P5 | |
| Visual Search (find every instance of a symbol) | Revu | P6 | Image matching in a worker |

### Markup

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| Highlight, underline, strikeout, squiggly | Both | ✅ | |
| Pen and highlighter pen | Both | ✅ | |
| Sticky notes and comments | Both | ✅ | Author is the Windows user |
| Text box with font, size, colour | Both | 🟡 | Latin text only; any Windows font and non-Latin text need font embedding (P1) |
| Proofreading: insert and replace text | Both | ✅ | |
| Rectangle, ellipse, line, arrow, polyline, polygon | Both | ✅ | |
| Stamps and image markups | Both | ✅ | |
| Signatures: draw, type or image | Both | ✅ | Certificate signing is P6 |
| Single-key tool shortcuts and tool lock | Revu | P1 | |
| Markup model with subject, label, status, layer, custom fields | Revu | P2 | Foundation for Revu compatibility and every Revu-like tool (M0) |
| Properties panel with live editing | Revu | P2 | M0 |
| Tool Chest: saved tool presets and tool sets, import and export | Revu | P3 | Builds on the P2 markup model |
| Rich-text box, typewriter, callout with movable leader | Both | P3 | M1, hardest piece: our own appearance streams. Revu text markups already display through their stored appearance |
| Line endings, dimension line, arc, curve | Revu | P3 | M2 |
| Clouds (rectangle, polygon, ellipse) and Cloud+ | Revu | P3 | M3. Acrobat has a basic cloud only |
| Image markup with border, opacity, crop, replace | Revu | P3 | M4 |
| Custom and dynamic stamps (date, user, status fields) | Both | P3 | |
| Copy and paste markups across pages and files; apply to many pages | Revu | P3 | |
| Align, distribute, group, lock, flatten one markup | Revu | P3 | M6 |
| Layers (assign markups, show/hide, export) | Revu | P3 | Optional content groups |
| Legends (auto-built from the markups on a page) | Revu | P3 | |
| Hyperlinks and auto-linking sheet references | Revu | P5 | Revu's Batch Link |
| Remove or flatten all annotations | Both | ✅ | |

### Markups List and review

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| Comments list | Both | 🟡 | Panel lists comments; the full grid is P2 |
| Markups List grid: group, sort, filter, show/hide columns, saved views | Revu | P2 | |
| Status, replies, check marks, review history | Both | P2 | |
| Custom columns (text, number, date, choice, yes/no, formula) | Revu | P2 | |
| Subtotals and totals | Revu | P2 | Needed by measurement in P4 |
| Export summary: CSV, XLSX, PDF | Both | P2 | Option to match Revu's Markup Summary layout |
| Read and write Bluebeam's own markup data | Revu | P2 | Tested on a private corpus of real Revu files. The headline P2 feature |
| Import and export comments (XFDF, FDF) | Both | P2 | How a local-only app shares a review |
| Compare documents | Both | ✅ | |
| Overlay pages (old in red, new in blue) | Revu | P3 | |
| Real-time cloud sessions (Studio Sessions, Acrobat shared review) | Both | ➖ | Needs a server and accounts. Shared-folder review with XFDF merge is the local answer (P2) |

### Measurement and takeoff

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| Show the values of measurements made in Revu | Revu | ✅ | Length, polylength, area, angle and count read from `/IT`, `/Measure` and `/VP`, and written back the way Revu writes them |
| Calibrate scale per page, preset scales, viewports with their own scale | Revu (Acrobat basic) | 🟡 | Draw a known length, presets and typed ratios per page or all pages; region viewports are read but not drawn |
| Length, polylength, perimeter, area | Both | ✅ | Acrobat has distance, perimeter and area only |
| Area with cutouts, volume (depth), radius, angle, diameter | Revu | 🟡 | Volume, wall height and angle are in; cutouts, radius and diameter are not |
| Count tool with symbols | Revu | 🟡 | Checkmark count, totalled per page and subject; other symbols are not |
| Measurement totals in the Markups List; export quantities | Revu | 🟡 | Totals and CSV export work; angle and count have no column yet |
| Snap to PDF content (endpoints, midpoints, intersections) | Revu | P4 | Reads vector paths from PDFium |
| Spaces: named regions that group markups (rooms, zones) | Revu | P4 | |
| Sketch to scale (draw by typed length and angle) | Revu | P4 | |
| Dynamic Fill (flood-fill an area to measure it) | Revu | P6 | Raster fill in a worker |

### Pages and documents

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| Page editor: reorder, rotate, delete, extract, by drag and drop | Both | ✅ | Multi Tool |
| Merge, split (by pages, size, bookmarks), reorganise | Both | ✅ | Bookmarks and form fields are not carried into a merge yet |
| Crop, watermark, page numbers | Both | ✅ | Watermark text is Latin only |
| Metadata, document info report | Both | ✅ | |
| Adobe-style Organize Pages grid: insert blank, from file, from clipboard image, replace, duplicate | Acrobat | P5 | Design in IMPLEMENTATION-PLAN "Organize pages" |
| Header and footer, Bates numbering, background | Both | P5 | |
| Edit existing text | Acrobat (Revu basic) | 🟡 | PDF Text Editor works; inline editing in the viewer with any Windows font is P5 |
| Edit, replace and move existing images | Acrobat | P5 | |
| Fill forms | Both | ✅ | |
| Create and edit form fields, auto-detect fields | Both | P5 | Field creation needs a client-side port |
| Attachments: add, remove, extract | Both | P5 | Viewing works today |
| Compress and optimise | Both | P5 | Image recompression in a worker; no Ghostscript (AGPL) |
| OCR scanned pages | Both | P5 | Windows built-in OCR from Rust |
| PDF to images, images to PDF | Both | P5 | Fully client-side |
| Office to PDF and PDF to Word | Both | P5 | Through the user's installed Office (COM); Word can open PDFs |

### Security, signing and compliance

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| Password protection and permissions | Both | ✅ | |
| Manual redaction | Both | ✅ | |
| Search and pattern redaction (phone numbers, emails, regex) | Both | P1 | Ships with the search panel |
| Sanitise: remove scripts, embedded files, metadata, links | Acrobat | ✅ | |
| Certificate signatures from the Windows certificate store, timestamps | Both | P6 | Rust cert store plus CMS signing |
| Validate signatures | Both | P6 | |
| PDF/A conversion and validation | Acrobat | P6 | |
| Accessibility check and tagging | Acrobat | P6 | |
| Request e-signatures from others (Acrobat Sign) | Acrobat | ➖ | A hosted service, out of scope for a local app |

### Productivity and platform

| Feature | From | Us | Notes |
| --- | --- | --- | --- |
| No account, no sign-in, works offline | — | ✅ | Both competitors require a vendor account |
| Save in place, atomic write | Both | ✅ | |
| Unsaved-changes guard on close | Both | 🟡 | Save option in the prompt is P1 |
| Reload when the file changes on disk | Revu | P1 | |
| File association, Explorer thumbnails, Jump List, taskbar buttons | Both | P1 | Per-user, no admin |
| Workspace profiles (panel layout, toolbars, shortcuts) | Revu | P3 | |
| Batch: apply a tool (flatten, stamp, header, sign) to many files | Both | Open question | Automate was removed on purpose; a simple "run this tool on N files" may come back |
| Document sets (a drawing package as one navigable set) | Revu | P6 | |
| Slip sheets (replace revised sheets, carry markups over) | Revu | P6 | |
| AI assistant | Acrobat | ➖ | Not without a local model; revisit later |
| macOS, web, iPad | Both | ➖ | Windows first; Tauri keeps macOS possible later |
| 3D PDF | Both | ➖ | Niche, heavy |

---

## Phases

Each phase ends with a usable release. Phases overlap where work is independent, but a phase's foundation lands before its features.

| Phase | Theme | Main deliverables | You can now… |
| --- | --- | --- | --- |
| **P1** | Snappy desktop core | Font embedding (`@pdf-lib/fontkit`, any Windows font, non-Latin text); Bluebeam-style search panel with bulk markup and search redaction; single-key tool shortcuts and tool lock; open-file switcher (Ctrl+Tab); reliable print; reload on external change; Save in the close prompt; file association and taskbar integration; profiling on large drawing sets | Use it as your everyday PDF reader and quick-markup tool on Windows |
| **P2** | Revu-compatible review | Markup model and Properties panel (M0); read and write Bluebeam's markup data (subject, status, layer, custom columns); Markups List grid with grouping, filters, status, replies, custom columns and totals; show the values of Revu measurements; CSV/XLSX/PDF summaries; XFDF import/export and shared-folder review | Open a Revu-marked drawing set without a Revu licence, see every markup with its status and columns, reply, change status and send it back |
| **P3** | Markup Studio | Tool Chest; rich text and callouts (M1); line ends, dimensions, arcs (M2); clouds and Cloud+ (M3); image markups (M4); custom stamps; copy/paste markups; snapshot; workspace profiles; layers; legends; overlay compare; split view; align/group/lock (M6) | Create markups the way you do in Revu |
| **P4** | Measurement and takeoff | Calibration and viewports; length, area, perimeter, volume, count, angle, radius; cutouts; snapping to PDF geometry; Spaces; sketch to scale; quantity export | Do quantity takeoffs without a Revu licence |
| **P5** | Acrobat-class editing | Inline text and image editing; Organize Pages grid; header/footer and Bates; page labels; hyperlinks and auto-linking; form field authoring; attachments; compress; OCR (Windows OCR); image and Office conversion | Replace Acrobat Pro for everyday document work |
| **P6** | Trust and scale | Certificate signing, timestamps, validation; PDF/A; accessibility check; document sets and slip sheets; Visual Search; Dynamic Fill | Use it for regulated and large-project work |

### Why this order

1. **P1 first** because speed and desktop feel are what people notice in the first minute, and font embedding unblocks every text feature after it.
2. **Revu compatibility before Revu authoring tools.** Bluebeam no longer offers a free viewer, so everyone who receives Revu-marked drawings without a licence is stuck. Reading, replying to and reporting on existing markups serves them first, and it is something neither Revu nor Acrobat will give away. It also forces the markup model to match Revu's data from day one, so the P3 tools write markups Revu users can read.
3. **Markup before measurement**: measurement markups are markups with extra data. The markup model and the Markups List totals (P2) are what measurement totals are built on.
4. **Acrobat editing after Bluebeam markup**: Acrobat-style editing is better served today by alternatives, while free Revu-style markup barely exists. That gap is where this app matters most.
5. **Signing and compliance last**: they need native Windows integration (certificate store) and careful validation, and they matter most once people trust the app with real projects.

## Risks

- **Rich-text appearance streams** (P3, M1) decide whether markups look the same in Revu, Acrobat and browsers. Spike early, during P2, so the P2 markup model does not need reworking.
- **Bluebeam compatibility** (P2) depends on undocumented keys. It needs a private corpus of real Revu files and their Markup Summary exports as the acceptance test.
- **Performance on drawing sets** (all phases): large-format vector sheets are the stress case. Keep a benchmark corpus and measure every phase against the budgets above.
- **Licence boundary**: features must be written fresh in `studio/` or ported from MIT code only. See [developer/FORK-FRONTEND-MAP.md](developer/FORK-FRONTEND-MAP.md).
