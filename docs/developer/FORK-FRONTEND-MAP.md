# Frontend map for this fork

Read this before touching `frontend/`. This fork is a local-only Windows desktop viewer with no backend. Product status lives in `docs/IMPLEMENTATION-PLAN.md`; edits to upstream code are listed in `docs/core-patches.md`.

## Layers and the licence boundary

| Path (under `frontend/src/`)                             | What it is                                 | Ours to edit?                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor/studio/`                                         | Our own layer, written from scratch (MIT). | Yes. Put new code here.                                                                                                                                     |
| `editor/core/`                                           | Upstream editor UI (MIT).                  | Sparingly. Log every edit in `docs/core-patches.md`.                                                                                                        |
| `editor/{desktop,proprietary,cloud,saas}/`, `processor/` | Upstream, restrictive licence.             | No. Never copy or port code from them. `scripts/licence-guard.mjs` fails the build if the studio bundle reaches them. They are excluded from our typecheck. |
| `../src-tauri/`                                          | Rust host (MIT).                           | Yes.                                                                                                                                                        |

## How `@editor/*` resolves

In studio mode (`vite --mode studio`, `tsconfig.studio.vite.json`) `@editor/x` resolves to `studio/x` first, then `core/x`. A studio file at the same path as a core file replaces it for the whole app, which is how we override upstream without editing it. Prefer a shadow file over a core edit when the file is small. Copying a 1000-line core file into studio makes upstream merges harder, so edit core there and log it.

## Checks (run from `frontend/`)

| Check     | Command                                                                        | Notes                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck | `npx tsc --noEmit -p tsconfig.studio.vite.json` (or `task frontend:typecheck`) | The only typecheck that matters; it excludes the upstream-only layers. Do not use `tsconfig.core.vite.json`: it pulls in `cloud/` and reports hundreds of errors that are not ours. |
| Lint      | `npx oxlint --config oxlint.config.ts --max-warnings=0`                        | Must be clean. Relative imports are banned except in `studio/**/*.test.*` (see below).                                                                                              |
| Tests     | `npx vitest run --project core --project studio`                               | Do not run bare `vitest run`: the `processor` and `proprietary` projects belong to upstream-only code and fail.                                                                     |
| Format    | `npx prettier --write <files>`                                                 |                                                                                                                                                                                     |

Studio tests import their subject relatively (`./merge`). The studio vitest project takes aliases from a tsconfig that excludes test files, so `@editor/*` does not resolve inside them; `oxlint.config.ts` has an override for that.

## i18n

`public/locales/en-US/translation.toml` is the source. Two tests enforce it: `tests/missingTranslations.test.ts` (a key used in source must exist) and `tests/unusedTranslations.test.ts` (a key with no reference must be removed). Deleting a feature therefore means deleting its keys too; the test prints each as `Unused en-US translation: <dotted.key>`, and a table-with-a-value is stored as `_value`. Plural keys use `_one` / `_other`.

## Removed features (stale code and tests)

The "Wipe backend-only tools" commit removed the tool pages for compress, OCR, convert, repair, certSign, Automate and others. `types/toolId.ts` lists what is left; `OPERATION_ONLY_TOOL_IDS` are operations kept only because live features call them. Tests that still import a removed tool (for example `@editor/tools/Compress`) fail to resolve and should be rewritten or deleted along with the feature, not worked around.

Tests of removed tools were deleted or rewritten around live tools (rotate, sign, merge), and the brand-mark click tests in `pages/HomePage.startupView.test.tsx` went with the removed `.quick-nav-brand-button`. `core` and `studio` pass in full; new tests must not name a removed tool or route.

The Java backend, Gradle, Docker and `app/` are gone. Font fixtures for the text-editor tests live in `src/editor/core/tests/test-fixtures/fonts/`. There is no `engine/`, no Docker/Gradle workflow and no release pipeline: `.github/workflows/ci.yml` runs the frontend checks and Rust lint, and `task pre-commit` runs its Python tools through pinned `uvx` calls.

## Units

Metric only: `POINT_TO_UNIT` in `core/utils/measurementUtils.ts` holds m, cm, mm and km, and `UNIT_OPTIONS`, the scale presets (`studio/services/markups/scalePresets.ts`) and `defaultExtent` follow it. Imperial units (ft, in, yd, mi), imperial presets and their locale keys were removed on purpose; do not add them back. A PDF whose `/VP` scale uses an imperial unit is read as having no scale (`parseScale` in `core/utils/pdfMeasurementExtraction.ts` drops units it does not know). The PDF point itself is defined as 1/72 inch, so that constant stays.

## Windows gotchas

- Files are CRLF on disk; git warns about it. Keep edits line-ending neutral (read and write with `newline=''` in scripts).
- Git Bash `/tmp` is not visible to a Windows `python`; pass paths through `cygpath -m`.
- `git stash` / `stash pop` rewrites the mtime of every dirty file. Avoid it on this working tree; compare with `git diff` or a worktree instead.

## More

- Files, workbench and the library sidebar: `docs/developer/WORKBENCH-AND-FILE-SIDEBAR.md`
- Adding a tool: `docs/developer/ADDING_TOOLS.md`
- Comment rules: `docs/developer/CODE_COMMENTS.md`
