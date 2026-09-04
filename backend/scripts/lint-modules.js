#!/usr/bin/env node
/**
 * lint-modules.js
 *
 * CI / lint check that enforces the documented module convention:
 * every directory under backend/src/modules/ must contain the three
 * canonical files: routes.js, service.js, and repository.js.
 *
 * Modules that have a deliberate, documented reason to differ can be
 * added to the EXEMPTIONS set below.  Prefer fixing the module over
 * adding an exemption.
 *
 * Usage:
 *   node scripts/lint-modules.js          # exits 0 on success, 1 on failure
 *   npm run lint:modules                  # same, via npm script
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────
const REQUIRED_FILES = ['routes.js', 'service.js', 'repository.js'];

// Modules that are deliberately exempt from the 3-file rule.
// Each entry should include a short reason so future contributors
// understand why the exemption exists.
const EXEMPTIONS = new Map([
  // -- These modules pre-date the convention and are tracked for
  //    incremental refactoring in follow-up issues.  Remove them from
  //    this list once each module has been brought into compliance.
  [
    'client-errors',
    'lightweight telemetry endpoint; no service or repository layer needed',
  ],
  ['ai', 'service.js extraction pending'],
  ['ai-certificates', 'repository.js extraction pending'],
  ['analytics', 'service.js extraction pending'],
  ['attendance', 'service.js extraction pending'],
  ['audit', 'service.js extraction pending'],
  ['canva', 'repository.js extraction pending'],
  ['meetings', 'service.js extraction pending'],
  ['notices', 'service.js extraction pending'],
  ['notifications', 'service.js extraction pending'],
  ['ratings', 'service.js extraction pending'],
  ['reports', 'service.js extraction pending'],
  ['sessions', 'service.js extraction pending'],
  ['social-tasks', 'service.js extraction pending'],
  ['team', 'service.js extraction pending'],
  ['uploads', 'service.js extraction pending'],
  ['uptoskills', 'repository.js extraction pending'],
  ['users', 'service.js extraction pending'],
  ['internops', 'independent from database (uses CSV parsing)'],
]);

// ── Main ─────────────────────────────────────────────────────────────
const modulesDir = path.join(__dirname, '..', 'src', 'modules');

if (!fs.existsSync(modulesDir)) {
  console.error(`ERROR: modules directory not found at ${modulesDir}`);
  process.exit(1);
}

const entries = fs
  .readdirSync(modulesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory());

let failures = 0;

for (const entry of entries) {
  if (EXEMPTIONS.has(entry.name)) {
    continue; // skip exempted modules
  }

  const moduleDir = path.join(modulesDir, entry.name);
  // Use existsSync instead of readdir + isFile() because OneDrive
  // cloud-only placeholders report isFile() === false even though
  // the file is logically present.
  const missing = REQUIRED_FILES.filter(
    (f) => !fs.existsSync(path.join(moduleDir, f))
  );
  if (missing.length > 0) {
    console.error(`FAIL  ${entry.name}/  — missing: ${missing.join(', ')}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} module(s) do not match the documented convention.`
  );
  console.error(
    'Fix the module or add it to the EXEMPTIONS list in scripts/lint-modules.js.\n'
  );
  process.exit(1);
} else {
  console.log(
    `OK  All ${entries.length} modules pass the structure check (${EXEMPTIONS.size} exempted).`
  );
}
