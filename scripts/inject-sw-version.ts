import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Stamps public/sw.js's CACHE_VERSION with the actual Next.js build ID so
// every deploy gets a fresh cache namespace automatically — see the comment
// above CACHE_VERSION in public/sw.js for why a hand-maintained version
// string is unsafe here. Runs as `postbuild` (see package.json), which npm
// invokes automatically after `npm run build` completes.
const ROOT = path.resolve(import.meta.dirname, "..");
const buildId = readFileSync(path.join(ROOT, ".next/BUILD_ID"), "utf8").trim();
const swPath = path.join(ROOT, "public/sw.js");
const sw = readFileSync(swPath, "utf8");

const stamped = sw.replace(
  /const CACHE_VERSION = ".*";/,
  `const CACHE_VERSION = "${buildId}";`
);

if (stamped === sw) {
  throw new Error(
    "inject-sw-version: CACHE_VERSION assignment not found in public/sw.js — check the regex still matches."
  );
}

writeFileSync(swPath, stamped);
console.log(`stamped public/sw.js CACHE_VERSION = ${buildId}`);
