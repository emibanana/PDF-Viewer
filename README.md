# PDF Viewer

A local-only Windows desktop PDF viewer and markup tool. No accounts, no login, no backend server, no online services.

This is a fork of [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) (upstream `594a564`, v3.5.0). The app is the upstream editor UI running in a small Tauri (Rust) shell, with our own layer on top.

**What's done, what's next, and what's deferred: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md)**

## Run it (Windows, no admin needed)

Prerequisites installed per-user: Node, Rust (`rustup`), and the Microsoft C++ build tools via
[portable-msvc](https://gist.github.com/mmozeiko/7f3162ec2988e81e56d5c4e22cde9977) into `%USERPROFILE%\tools\msvc`.
`dev-env.ps1` puts them on `PATH`.

```powershell
cd frontend
npm ci
. ..\dev-env.ps1
npx tauri dev
```

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

- `upstream` remote = Stirling-Tools/Stirling-PDF. `main` mirrors it; never commit to `main`.
- `studio` is the product branch. Add your own fork as `origin` with `git remote add origin <url>`.

## Licence

The root licence is MIT, but `frontend/src/editor/{desktop,proprietary,cloud,saas}`, `frontend/src/processor`, and `engine` carry the restrictive Stirling PDF User License. This product never uses code from those directories, and the build fails if it tries to. See the plan for details.
