# AGENTS.md

This file provides guidance to AI Agents when working with code in this repository.

## This repository is a fork: start here

This is a local-only Windows desktop PDF viewer and markup tool forked from Stirling-PDF. The Java backend, Gradle build and Docker setup have been deleted; some sections below are still upstream text, so trust the docs linked here first. Our work is in `frontend/src/editor/studio/`, `frontend/src-tauri/` and small, logged edits to `frontend/src/editor/core/`. Never copy code from the `desktop`, `proprietary`, `cloud`, `saas` or `processor` layers (restrictive licence).

Read on demand, only for the area you are touching:

- Layers, alias resolution, which checks to run (and which not to), i18n rules, removed features, Windows gotchas: `docs/developer/FORK-FRONTEND-MAP.md`
- Open files (workbench), views, and the file/library sidebar: `docs/developer/WORKBENCH-AND-FILE-SIDEBAR.md`
- Product status: `docs/IMPLEMENTATION-PLAN.md`
- Product direction (Bluebeam + Acrobat feature map and phases): `docs/ROADMAP.md`. Keep its marks and the README comparison table in step when a feature ships
- Every edit we made to upstream `core/`: `docs/core-patches.md` (add a row when you edit core)

Frontend checks that matter (from `frontend/`): `npx tsc --noEmit -p tsconfig.studio.vite.json`, `npx oxlint --config oxlint.config.ts --max-warnings=0`, `npx vitest run --project core --project studio`. Keep the relevant doc above updated when you learn something the next agent would otherwise have to rediscover.

## Taskfile (Recommended)

This project uses [Task](https://taskfile.dev/) as a unified command runner. All build, dev, test and lint commands can be run from the repo root via `task <command>`. Run `task --list` to see all available commands.

Task `desc:` fields should describe **what** the task does, not **how** it does it. Keep them generic and stable: don't reference implementation details like aliases, internal helpers, mode flags, or which other task delegates to which. The description is for users picking a command from `task --list`, not a changelog of refactors.

### Quick Reference
- `task install` — install dependencies
- `task dev` — start the frontend dev server
- `task desktop:dev` — start the desktop app (same as `npx tauri dev` in `frontend/`)
- `task test` — run frontend and Rust tests
- `task lint` — run all linters
- `task format` — auto-fix formatting
- `task check` — full quality gate (lint + typecheck + test)
- `task clean` — clean build artifacts

## Comments

A comment must carry information the code cannot. If a reader could derive it from the code in front of them, delete it.

Comment the current state. Not what the code used to do, not what changed, not why it changed: git holds that. Where history explains the shape, state the reason instead, so "this used to reimplement the modal internals" becomes "thin wrapper over the shared Modal: duplicating its portal and focus trap is how dialogs drift apart". Future state goes in a TODO with an issue.

Write a comment when it does one of these four jobs:

- **Contract.** What a caller must know that the signature cannot say: preconditions, invariants, units, ownership and lifetime, thread-safety, error semantics, side effects. Document the contract of everything a caller outside the file can reach, and nothing else. Goes on the type/method/module as Javadoc, JSDoc, or a docstring.
- **Why.** The constraint the code satisfies, the bug it avoids, the alternative rejected and the reason.
- **Hazard.** "Must stay in sync with X", "order matters because Y", "do not remove, it prevents Z".
- **Map.** A short orientation at the top of a genuinely complex file: what it owns, and what it deliberately does not.

Never write:

- A comment that restates the next line. `// Handle drag start` above `handleDragStart` is noise.
- Section banners or position markers: `// --- Types ---`, `// Helpers`, `// =====`.
- Step narration in a function body (`// Step 1:`, `// Then we`). If the steps need labels they need names: extract functions. Numbering a genuinely numbered thing, like a wizard step, is fine.
- Commented-out code. Delete it.
- Doc tags that restate the signature. `@param blob - The blob` says nothing; omit the tag rather than pad it.
- Docs on self-explanatory members with no constraint to state.

Two tests before keeping a comment:

- **Delete it.** Is any information lost? If not, it stays deleted.
- **Could a name carry it instead?** A better identifier, an extracted function, or a named constant beats a comment. Prefer the code change.

A comment at the end of a line usually decodes that line, and that is worth keeping: `{0x25, 0x50} // "%PDF"`, `50L * 1024 * 1024 // 50 MB`. The rules that compare a comment against the code below it do not apply there, but a trailing TODO or a trailing bit of history is judged like any other.

A reference is supplementary, never load-bearing: the comment must survive deleting it. `// See #1234` is a dead end; `// saving first loses every annotation (#6865)` is not. Prefer a spec (`RFC 3161`) or CVE where one applies.

A TODO needs an issue, not an owner: `// TODO(#1234): re-enable the gate once account syncing lands`. If it is not worth an issue, it is not worth a TODO. A question is not a TODO.

A comment block over ~12 lines outside a file or type header usually means the code needs restructuring, or that the prose is product documentation and belongs in the docs repo.

`task comment-lint` checks the mechanical part of this on the lines you add, and runs inside `task pre-commit`. Reasoning, worked examples and the linter's own rules: @docs/developer/CODE_COMMENTS.md

## Common Development Commands

### Build and Test
- **Run the app**: `npx tauri dev` from `frontend/`
- **Run all tests**: `task test` (or `task frontend:test`, `task desktop:test`)
- **Code formatting**: `task format`
- **Full quality gate**: `task check`

After modifying any files in the project, run the relevant check: `task frontend:check` for frontend files, `task desktop:check` for Rust. See `docs/developer/FORK-FRONTEND-MAP.md` for what each check covers.

### Frontend Development
- **Frontend dev server**: `task frontend:dev` (studio mode, no backend)
- **Tech Stack**: Vite + React + TypeScript + Mantine UI + TailwindCSS, hosted by Tauri 2 (Rust)
- **i18n Ready**: Built-in internationalization support
- **Type Safe**: Full TypeScript support with generic interfaces
- **Memory Safe**: Automatic resource cleanup and blob URL management

## Architecture Overview

### Project Structure
- **Frontend**: React SPA in `/frontend`; `src/editor/studio` is ours, `src/editor/core` is upstream
  - **File Storage**: IndexedDB for client-side file persistence and thumbnails
- **Host**: Tauri 2 (Rust) in `frontend/src-tauri`: window, single-instance file forwarding, atomic save
- **PDF Processing**: PDFium (viewer) and pdf-lib (`studio/services/pdfEdit`), all client-side. There is no server

### Frontend Directory Structure
The frontend is organized with a clear separation of concerns:

- **`frontend/src/editor/core/`**: Main application code (shared, production-ready components)
  - **`core/components/`**: React components organized by feature
    - `core/components/tools/`: Individual PDF tool implementations
    - `core/components/viewer/`: PDF viewer components
    - `core/components/pageTracks/`: Page editor (every open PDF as a track of pages)
    - `core/components/tooltips/`: Help tooltips for tools
    - `core/components/shared/`: Reusable UI components
  - **`core/contexts/`**: React Context providers
    - `FileContext.tsx`: Central file state management
    - `file/`: File reducer and selectors
    - `toolWorkflow/`: Tool workflow state
  - **`core/hooks/`**: Custom React hooks
    - `hooks/tools/`: Tool-specific operation hooks (one directory per tool)
    - `hooks/tools/shared/`: Shared hook utilities (useToolOperation, etc.)
  - **`core/constants/`**: Application constants and configuration
  - **`core/data/`**: Static data (tool taxonomy, etc.)
  - **`core/services/`**: Business logic services (PDF processing, storage, etc.)

- **`frontend/src/editor/desktop/`**: Desktop-specific (Tauri) code
- **`frontend/src/editor/proprietary/`**: Proprietary/licensed features
- **`frontend/src-tauri/`**: Tauri (Rust) native desktop application code
- **`frontend/public/`**: Static assets served directly
  - `public/locales/`: Translation JSON files

### Component Architecture
- **Static Assets**: `frontend/public/`
- **Internationalization**: TOML files in `frontend/public/locales/`; `en-US` is the source

### Testing Strategy
- **Unit and component tests**: Vitest (`task frontend:test`)
- **Browser tests**: Playwright

#### No fixed waits in tests
Never sleep in tests (`page.waitForTimeout`, `Thread.sleep`, etc.) - it causes flakes. Wait for the actual condition instead (`expect(...)`, `expect.poll`, `waitForFunction`, `vi.waitFor`), or use fake timers for time-based behaviour.

## Development Workflow

1. **Local Development**: `npx tauri dev` from `frontend/`, or `task frontend:dev` for the browser
2. **Quality Gate**: Run `task check` before committing
3. **Translations**: Update `frontend/public/locales/en-US/translation.toml`; see `docs/developer/FORK-FRONTEND-MAP.md`

## Frontend Architecture Status

- **Core Status**: React SPA architecture complete with multi-tool workflow support
- **State Management**: FileContext handles all file operations and tool navigation
- **File Processing**: Production-ready with memory management for large PDF workflows (up to 100GB+)
- **Tool Integration**: Modular hook architecture with `useToolOperation` orchestrator
  - Individual hooks: `useToolState`, `useToolApiCalls`, `useToolResources`
  - Utilities: `toolErrorHandler`, `toolResponseProcessor`, `toolOperationTracker`
  - Pattern: Each tool creates focused operation hook, UI consumes state/actions
- **Preview System**: Tool results can be previewed without polluting file context (Split tool example)
- **Performance**: Web Worker thumbnails, IndexedDB persistence, background processing

## Translation Rules

- **CRITICAL**: Always update translations in `en-US` only - all other languages (including `en-GB`) are handled separately
- Translation files are located in `frontend/public/locales/`
- After changing any translation file, run `task pre-commit:fix`

## Important Notes

- **File Persistence**:
  - Uses IndexedDB for client-side file storage and caching (with thumbnails)
- **Fail Closed**: When a credential, owner, team or scope is missing or can't be resolved, refuse or use the narrowest option (the caller's own identity or personal scope). Never substitute a broader principal's credentials (the server's, an admin's or a service account's), treat an unknown caller as trusted, or widen scope. Open access (login disabled, desktop local mode, SaaS guests, share links) must come from explicit configuration or identity, never from a null or a failed request
- **Import Paths**: ALWAYS use `@editor/*` for imports - never use `@editor-core/*` or `@editor-proprietary/*` unless explicitly wrapping/extending a lower layer
- **FileContext**: All file operations MUST go through FileContext - never bypass with direct File handling
- **Memory Management**: Manual cleanup required for PDF.js documents and blob URLs - don't remove cleanup code
- **Tool Development**: New tools should follow `useToolOperation` hook pattern (see `useCompressOperation.ts`)
- **Performance Target**: Must handle PDFs up to 100GB+ without browser crashes
- **Preview System**: Tools can preview results without polluting main file context (see Split tool implementation)
- **Adding Tools**: See `docs/developer/ADDING_TOOLS.md` for complete guide to creating new PDF tools

## Communication Style
- Be direct and to the point
- No apologies or conversational filler
- Answer questions directly without preamble
- Explain reasoning concisely when asked
- Avoid unnecessary elaboration

## Decision Making
- Ask clarifying questions before making assumptions
- Stop and ask when uncertain about project-specific details
- Confirm approach before making structural changes
- Request guidance on preferences (cross-platform vs specific tools, etc.)
- Verify understanding of requirements before proceeding
