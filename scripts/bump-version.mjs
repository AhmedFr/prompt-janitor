// Bump the app version in every file that carries it, so releases can't ship
// with package.json, Cargo.toml, and tauri.conf.json out of sync.
//
//   pnpm bump 0.2.0   →  edit files, then commit and `git tag v0.2.0 && git push --tags`

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? "")) {
  console.error("Usage: pnpm bump <semver>   e.g. pnpm bump 0.2.0");
  process.exit(1);
}

const edits = [
  {
    file: "package.json",
    from: /("version":\s*")[^"]+(")/,
    to: `$1${version}$2`,
  },
  {
    file: "src-tauri/tauri.conf.json",
    from: /("version":\s*")[^"]+(")/,
    to: `$1${version}$2`,
  },
  {
    // Only the [package] header block — the first `version =` in the file.
    file: "src-tauri/Cargo.toml",
    from: /^(version\s*=\s*")[^"]+(")/m,
    to: `$1${version}$2`,
  },
  {
    // Keep the lockfile's own entry in sync so builds don't dirty it.
    file: "src-tauri/Cargo.lock",
    from: /(name = "prompt-janitor"\nversion = ")[^"]+(")/,
    to: `$1${version}$2`,
  },
];

for (const { file, from, to } of edits) {
  const path = resolve(root, file);
  const before = readFileSync(path, "utf8");
  const after = before.replace(from, to);
  if (after === before) {
    console.error(`No version found to replace in ${file} — aborting.`);
    process.exit(1);
  }
  writeFileSync(path, after);
  console.log(`✓ ${file} → ${version}`);
}

console.log(`\nNext: commit, then \`git tag v${version} && git push origin v${version}\``);
