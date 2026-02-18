#!/usr/bin/env node
/**
 * Strips all deprecated fields from an OpenAPI YAML file and sets wide mode on every path.
 * - Removes any property whose value is an object with deprecated: true
 * - Removes any property whose value is a $ref (or array of $ref) to a deprecated schema
 * - Removes the deprecated key from remaining objects
 * - Adds x-mint.metadata.mode: wide to each path operation so pages render in wide mode
 *
 * Usage (from api-reference):
 *   node scripts/strip-deprecated.js                    # openapi.yml → openapi.no-deprecated.yml
 *   node scripts/strip-deprecated.js input.yml         # out: input.no-deprecated.yml
 *   node scripts/strip-deprecated.js input.yml out.yml # explicit in/out
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

const apiRefDir = path.join(__dirname, '..');
const args = process.argv.slice(2);
const inputFile = args[0] || path.join(apiRefDir, 'openapi.yml');
const outputFile = args[1] || inputFile.replace(/\.(yml|yaml)$/i, '.no-deprecated.$1');

/** Returns schema name for #/components/schemas/Name or null. */
function getSchemaNameFromRef(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

/** Returns true if the value is a ref (or array of ref) to a deprecated schema. */
function isRefToDeprecatedSchema(val, deprecatedSchemaNames) {
  if (!val || typeof val !== 'object' || Array.isArray(val) || !deprecatedSchemaNames.size) return false;
  const directRef = getSchemaNameFromRef(val.$ref);
  if (directRef && deprecatedSchemaNames.has(directRef)) return true;
  if (val.type === 'array' && val.items && typeof val.items === 'object' && val.items.$ref) {
    const itemsRef = getSchemaNameFromRef(val.items.$ref);
    if (itemsRef && deprecatedSchemaNames.has(itemsRef)) return true;
  }
  return false;
}

/** Build set of schema names that are deprecated (in components.schemas). */
function buildDeprecatedSchemaNames(spec) {
  const names = new Set();
  const schemas = spec?.components?.schemas;
  if (!schemas || typeof schemas !== 'object') return names;
  for (const [name, schema] of Object.entries(schemas)) {
    if (schema && typeof schema === 'object' && schema.deprecated === true) names.add(name);
  }
  return names;
}

function stripDeprecated(value, deprecatedSchemaNames) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => stripDeprecated(v, deprecatedSchemaNames));
  }

  const result = {};
  for (const key of Object.keys(value)) {
    const val = value[key];
    // Remove entire property if its value is an object marked deprecated
    if (val && typeof val === 'object' && !Array.isArray(val) && val.deprecated === true) {
      continue;
    }
    // Remove property if it refers to a deprecated schema (direct $ref or array items $ref)
    if (isRefToDeprecatedSchema(val, deprecatedSchemaNames)) {
      continue;
    }
    result[key] = stripDeprecated(val, deprecatedSchemaNames);
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
  const deprecatedSchemaNames = buildDeprecatedSchemaNames(spec);
  const stripped = stripDeprecated(spec, deprecatedSchemaNames);
  ensureWideMode(stripped);

  fs.writeFileSync(outputFile, yaml.stringify(stripped), 'utf8');
  console.log(`Wrote ${path.basename(outputFile)} (deprecated removed, wide mode set)`);
}

main();
