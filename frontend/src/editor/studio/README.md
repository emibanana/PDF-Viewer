# studio: the PDF Viewer desktop layer

Our own desktop layer, written from scratch (MIT, see `LICENSE`).

In `--mode studio` the `@editor/*` alias resolves `studio/*` first, then `core/*`
(see `tsconfig.studio.vite.json`). A file here with the same path as a `core` file
replaces it for the studio build.

Rules:

1. Never copy or port code from `../desktop`, `../proprietary`, `../cloud`, `../saas`
   or `../../processor`. Those carry the restrictive Stirling PDF User License.
2. `scripts/licence-guard.mjs` fails the build if the studio module graph
   resolves into one of those directories.
