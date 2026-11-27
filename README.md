# PDF Viewer

**A fast, free and open-source PDF markup and editing studio for Windows.**

Read, mark up, organise and protect PDFs in one lightweight desktop app. No account, no subscription, no cloud: your files never leave your machine.

![PDF Viewer showing an architectural floor plan at 218% zoom, with recent files and the other drawings in the same folder in the left panel](docs/screenshots/viewer.png)

> **Early but usable.** Version 0.1. The viewer, markup and page tools work today; the professional markup, measurement and editing features below are on the [roadmap](docs/ROADMAP.md).

## Why PDF Viewer

Professionals who work with drawings and documents usually pay for two tools: **Bluebeam Revu** to mark up and measure, and **Adobe Acrobat Pro** to edit and manage PDFs. PDF Viewer is building towards both in a single free app, with the quick, keyboard-first feel of a professional markup tool.

- **Fast.** PDFium rendering with flash-free zoom, a document on screen in about half a second, and one small native host instead of a browser tab and a server.
- **Local and private.** No login, no telemetry service, no online features. Ctrl+S saves straight back to the file, atomically.
- **Really free.** Open source, no feature tiers, no trial, no watermark.
- **Feels native.** Each PDF opens in its own window, the window title shows unsaved changes, Windows fonts are used for rendering, and markups carry your Windows user name.

PDF Viewer starts from the [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) editor UI (MIT) and reshapes it into a desktop app: the Java backend, Docker setup and server-only tools are gone, and the tools that needed a server are being re-written to run inside the app.

## What you can do today

- **Read**: smooth zoom and scroll, thumbnails, bookmarks, attachments and comments panels, find and replace text.
- **Mark up**: highlight, underline, strikeout, squiggly, pen and highlighter, text boxes, sticky notes, insert and replace text, rectangles, ellipses, lines, arrows, polylines, polygons, stamps, images and signatures.
- **Organise pages**: drag-and-drop page editor, merge, split, rotate, extract, delete, reorganise, crop.
- **Edit and annotate documents**: edit text, fill forms, watermark, page numbers, metadata, adjust colours, compare two documents.
- **Protect**: passwords and permissions, manual redaction, sanitise (scripts, embedded files, metadata), flatten.

## How it compares

| Feature | PDF Viewer | Bluebeam Revu | Acrobat Pro |
| --- | :---: | :---: | :---: |
| **Price** | Free, open source | Paid subscription | Paid subscription |
| **Account needed** | None | Bluebeam ID | Adobe ID |
| **Platforms** | Windows | Windows, plus web and iPad | Windows, macOS, web, mobile |
| _Viewing_ | | | |
| Fast viewer, thumbnails, bookmarks, text search | ✅ | ✅ | ✅ |
| Search across files with bulk markup from results | 🗺️ | ✅ | 🟡 |
| Visual (symbol) search | 🗺️ | ✅ | ❌ |
| _Markup_ | | | |
| Text markup, pen, notes, shapes, stamps, signatures | ✅ | ✅ | ✅ |
| Text boxes and proofreading marks | ✅ | ✅ | ✅ |
| Callouts, clouds and Cloud+ | 🗺️ | ✅ | 🟡 |
| Tool Chest of reusable markup tools | 🗺️ | ✅ | ❌ |
| Live properties panel and single-key tool shortcuts | 🗺️ | ✅ | 🟡 |
| Layers and legends | 🗺️ | ✅ | 🟡 |
| Markups List with status, custom columns and CSV/XLSX export | 🟡 | ✅ | 🟡 |
| _Measurement_ | | | |
| Calibrated length, perimeter and area | 🗺️ | ✅ | 🟡 |
| Count, volume, cutouts and quantity totals | 🗺️ | ✅ | ❌ |
| _Review_ | | | |
| Compare documents | ✅ | ✅ | ✅ |
| Overlay pages | 🗺️ | ✅ | ❌ |
| Import and export comments (XFDF/FDF) | 🗺️ | ✅ | ✅ |
| Real-time cloud collaboration | ➖ | ✅ | ✅ |
| _Pages and editing_ | | | |
| Merge, split, reorder, rotate, extract, crop | ✅ | ✅ | ✅ |
| Watermark and page numbers | ✅ | ✅ | ✅ |
| Headers, footers and Bates numbering | 🗺️ | 🟡 | ✅ |
| Edit existing text and images | 🟡 | 🟡 | ✅ |
| Fill forms | ✅ | ✅ | ✅ |
| Create form fields | 🗺️ | ✅ | ✅ |
| OCR scanned documents | 🗺️ | ✅ | ✅ |
| Compress and optimise | 🗺️ | ✅ | ✅ |
| Office to PDF and PDF to Word | 🗺️ | 🟡 | ✅ |
| _Security_ | | | |
| Passwords and permissions | ✅ | ✅ | ✅ |
| Redaction | 🟡 | ✅ | ✅ |
| Certificate digital signatures | 🗺️ | ✅ | ✅ |

✅ available · 🟡 partial · 🗺️ on our [roadmap](docs/ROADMAP.md) · ❌ not offered · ➖ not planned (needs a server)

Competitor columns reflect Bluebeam Revu 21 (Complete) and Adobe Acrobat Pro as publicly described in late 2026; check the vendors' sites for current details. PDF Viewer is not affiliated with Bluebeam or Adobe, and their names are trademarks of their owners.

## Roadmap

| Phase | Theme | Highlights |
| --- | --- | --- |
| **P1** | Snappy desktop core | Any Windows font and non-Latin text, Bluebeam-style search panel, single-key tools, file switcher, print, file association |
| **P2** | Markup Studio | Properties panel, Tool Chest, rich text and callouts, clouds, dimension lines, custom stamps |
| **P3** | Markups List and review | Markup grid with status and custom columns, summaries, Bluebeam compatibility, XFDF review, layers, overlay |
| **P4** | Measurement and takeoff | Calibration, length, area, volume, count, cutouts, snapping, quantity export |
| **P5** | Acrobat-class editing | Inline text and image editing, Organize Pages, headers and Bates, forms, OCR, compress, Office conversion |
| **P6** | Trust and scale | Certificate signing, PDF/A, accessibility, document sets, Visual Search |

The full feature-by-feature map is in [docs/ROADMAP.md](docs/ROADMAP.md); day-to-day status is in [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

## Getting started

There is no published installer yet, so build it from source. Everything installs per-user; no admin rights needed.

You need:

- Windows 10 or 11 with the WebView2 runtime (included with Windows 11)
- Node.js 20 or newer (with npm)
- Rust, installed with [rustup](https://rustup.rs) (stable, MSVC target)
- Microsoft C++ build tools, either of:
  - Visual Studio Build Tools with the "Desktop development with C++" workload, or
  - the per-user [portable-msvc](https://gist.github.com/mmozeiko/7f3162ec2988e81e56d5c4e22cde9977) in `%USERPROFILE%\tools\msvc`
- PowerShell for building (not Git Bash: its GNU `link` shadows the MSVC linker)

Then, from `frontend/`:

```powershell
npm ci
npx tauri dev       # run the app
npx tauri build     # build the installer
```

- The installer is written to `frontend/src-tauri/target/release/bundle/nsis/PDF Viewer_<version>_x64-setup.exe` and installs per-user.
- Keep the npm `@tauri-apps/*` packages on the same major/minor as the Rust `tauri` crates.
- Avoid a blanket `cargo update`; it can pull in duplicate `webview2-com-sys` versions that break the build.

## For contributors

| Command (from `frontend/`) | What it does |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.studio.vite.json` | Typecheck the app |
| `npx oxlint --config oxlint.config.ts --max-warnings=0` | Lint |
| `npx vitest run --project core --project studio` | Unit tests |
| `cargo test` (in `frontend/src-tauri`) | Rust host tests |
| `python scripts/studio/gen-brand.py` | Regenerate every logo and icon from `studio/assets/brand/mark.svg` |
| `node scripts/studio/rebrand-locales.mjs` | Re-apply the product name to the locale files |

| Path | What |
| --- | --- |
| `frontend/src/editor/studio/` | Our UI layer. A file here with the same path as one in `core/` replaces it in our build |
| `frontend/src-tauri/` | Rust host: window, file open and save, single instance, Windows fonts |
| `frontend/scripts/studio/` | Brand and locale tooling |
| `frontend/src/editor/core/` | Upstream editor UI (MIT). Our edits here are kept small and logged in [docs/core-patches.md](docs/core-patches.md) |

Start with [AGENTS.md](AGENTS.md) and [docs/developer/FORK-FRONTEND-MAP.md](docs/developer/FORK-FRONTEND-MAP.md) for how the layers fit together. `main` is the product branch; the `upstream` remote is Stirling-Tools/Stirling-PDF, merged in when wanted.

## Licence

PDF Viewer is MIT licensed. The upstream directories `frontend/src/editor/{desktop,proprietary,cloud,saas}`, and `frontend/src/processor` carry the restrictive Stirling PDF User License; this product never uses code from them, and the build fails if it tries to.
