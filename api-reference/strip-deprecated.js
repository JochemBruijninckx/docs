#!/usr/bin/env node
/**
 * Strips all deprecated fields from an OpenAPI YAML file.
 * - Removes any property whose value is an object with deprecated: true
 * - Removes the deprecated key from remaining objects
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

function main() {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputFile, 'utf8');
  const spec = yaml.parse(content);
  const stripped = stripDeprecated(spec);

  fs.writeFileSync(outputFile, yaml.stringify(stripped), 'utf8');
  console.log(`Wrote ${path.basename(outputFile)} (deprecated fields removed)`);
}

main();
