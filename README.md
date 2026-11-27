# PDF Viewer

A local-only Windows desktop PDF viewer and markup tool. No accounts, no login, no backend server, no online services.

Built on the [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) editor UI (MIT), running in a small Tauri (Rust) shell with our own layer on top.

![PDF Viewer with a document open and the tools panel](docs/screenshots/viewer.png)

**What's done, what's next, and what's deferred: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md)**

## Getting started (Windows, no admin needed)

What you need:

- Windows 10/11 with the WebView2 runtime (included with Windows 11)
- Node.js 20 or newer (with npm)
- Rust, installed with [rustup](https://rustup.rs) (stable, MSVC target)
- Microsoft C++ build tools, either of:
  - Visual Studio Build Tools with the "Desktop development with C++" workload, or
  - the per-user [portable-msvc](https://gist.github.com/mmozeiko/7f3162ec2988e81e56d5c4e22cde9977) in `%USERPROFILE%\tools\msvc` (no admin needed)
- PowerShell for building (not Git Bash: its GNU `link` shadows the MSVC linker)

Then, from `frontend/`:

```powershell
npm ci
npx tauri dev       # run the app
npx tauri build     # build the installer
```

- The NSIS installer is written to `frontend/src-tauri/target/release/bundle/nsis/PDF Viewer_<version>_x64-setup.exe` and installs per-user.
- Keep the npm `@tauri-apps/*` packages on the same major/minor as the Rust `tauri` crates.
- Avoid a blanket `cargo update`; it can pull in duplicate `webview2-com-sys` versions that break the build.

Other commands (from `frontend/`):

| Command | What it does |
|---|---|
| `npx vitest run --project studio` | Unit tests for our tool ports |
| `npx tsc --noEmit -p tsconfig.studio.vite.json` | Typecheck the studio build |
| `cargo test` (in `frontend/src-tauri`) | Rust host tests |
| `python scripts/studio/gen-brand.py` | Regenerate every logo and icon from `studio/assets/brand/mark.svg` |
| `node scripts/studio/rebrand-locales.mjs` | Re-apply the product name to the locale files |

## Where our code lives

| Path | What |
|---|---|
| `frontend/src/editor/studio/` | Our UI layer. A file here with the same path as one in `core/` replaces it in our build |
| `frontend/src-tauri/` | Rust host: window, file open/save, single instance |
| `frontend/scripts/studio/` | Brand and locale tooling |
| `frontend/src/editor/core/` | Upstream editor UI (MIT). Keep our edits here minimal |

## Git

- `main` is the product branch.
- `upstream` remote = Stirling-Tools/Stirling-PDF, for pulling in upstream changes when wanted.

## Licence

The root licence is MIT, but `frontend/src/editor/{desktop,proprietary,cloud,saas}`, `frontend/src/processor`, and `engine` carry the restrictive Stirling PDF User License. This product never uses code from those directories, and the build fails if it tries to. See the plan for details.
