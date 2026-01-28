#!/usr/bin/env node
/**
 * Strips all deprecated fields from an OpenAPI YAML file and sets wide mode on every path.
 * - Removes any property whose value is an object with deprecated: true
 * - Removes the deprecated key from remaining objects
 * - Adds x-mint.metadata.mode: wide to each path operation so pages render in wide mode
 *
 * Usage:
 *   node strip-deprecated.js                    # in/out: openapi.yml → openapi.no-deprecated.yml
 *   node strip-deprecated.js input.yml         # out: input.no-deprecated.yml
 *   node strip-deprecated.js input.yml out.yml # explicit in/out
 */

const fs = require('fs');
const path = require('path');

let yaml;
try {
  yaml = require('yaml');
} catch {
  console.error('Missing dependency. Run: npm install');
  process.exit(1);
}

const args = process.argv.slice(2);
const inputFile = args[0] || path.join(__dirname, 'openapi.yml');
const outputFile = args[1] || inputFile.replace(/\.(yml|yaml)$/i, '.no-deprecated.$1');

function stripDeprecated(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stripDeprecated);
  }

  const result = {};
  for (const key of Object.keys(value)) {
    const val = value[key];
    // Remove entire property if its value is an object marked deprecated
    if (val && typeof val === 'object' && !Array.isArray(val) && val.deprecated === true) {
      continue;
    }
    result[key] = stripDeprecated(val);
    // Remove deprecated key from objects we keep
    if (result[key] && typeof result[key] === 'object' && 'deprecated' in result[key]) {
      delete result[key].deprecated;
    }
  }
  return result;
}

const OPERATION_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function ensureWideMode(spec) {
  if (!spec.paths || typeof spec.paths !== 'object') return;
  for (const pathItem of Object.values(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const key of Object.keys(pathItem)) {
      if (!OPERATION_METHODS.has(key)) continue;
      const op = pathItem[key];
      if (!op || typeof op !== 'object') continue;
      if (!op['x-mint']) op['x-mint'] = {};
      if (!op['x-mint'].metadata) op['x-mint'].metadata = {};
      op['x-mint'].metadata.mode = 'wide';
    }
  }
}

function main() {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf8');
  const spec = yaml.parse(content);
  const stripped = stripDeprecated(spec);
  ensureWideMode(stripped);

  fs.writeFileSync(outputFile, yaml.stringify(stripped), 'utf8');
  console.log(`Wrote ${path.basename(outputFile)} (deprecated removed, wide mode set)`);
}

main();
