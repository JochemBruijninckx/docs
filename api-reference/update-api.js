#!/usr/bin/env node
/**
 * Single entry point when you have a new openapi.yml.
 *
 * 1. Strips deprecated fields and sets wide mode → openapi.no-deprecated.yml
 * 2. Generates Mintlify schema snippets → snippets/api/*.mdx
 *
 * Usage (from api-reference):
 *   npm run update-api
 *   node update-api.js
 *
 * The steps are implemented in scripts/ (strip-deprecated.js, schema-to-mintlify.js).
 */

const path = require("path");
const { spawnSync } = require("child_process");

const apiRefDir = __dirname;
const scriptsDir = path.join(apiRefDir, "scripts");

function run(scriptName) {
  const scriptPath = path.join(scriptsDir, scriptName);
  const result = spawnSync("node", [scriptPath], {
    stdio: "inherit",
    cwd: apiRefDir,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Step 1: Strip deprecated → openapi.no-deprecated.yml");
run("strip-deprecated.js");

console.log("\nStep 2: Generate schema snippets → snippets/api/");
run("schema-to-mintlify.js");

console.log("\nDone.");
