// Replaces the product name ("Stirling PDF" and a bare "Stirling") in the bundled locale files. Idempotent.
// Run from frontend/: node scripts/studio/rebrand-locales.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../public/locales/", import.meta.url));
const brand = JSON.parse(
  readFileSync(new URL("../../src/editor/studio/assets/brand/brand.json", import.meta.url), "utf8"),
);
const NAME = brand.name;
// After a rename, pass the previous name: node scripts/studio/rebrand-locales.mjs "Old Name"
const previous = process.argv[2];
let changed = 0;
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const file = join(root, dir.name, "translation.toml");
  if (!existsSync(file)) continue;
  const before = readFileSync(file, "utf8");
  let after = before
    .replace(/Stirling[ -]PDF/g, NAME)
    .replace(/Stirling(?![A-Za-z])/g, NAME);
  if (previous && previous !== NAME) after = after.split(previous).join(NAME);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`rebranded ${changed} locale file(s)`);
