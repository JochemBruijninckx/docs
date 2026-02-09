#!/usr/bin/env node
/**
 * Generates Mintlify ResponseField/Expandable markdown snippets from OpenAPI schemas.
 *
 * Usage (from api-reference):
 *   node scripts/schema-to-mintlify.js [schema1] [schema2] ...
 *
 * If no schema names are passed, the SCHEMAS_TO_CONVERT list below is used.
 * Schema names must match keys under components.schemas in openapi.no-deprecated.yml.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

// ---------------------------------------------------------------------------
// INPUT: Add schema names here to generate snippets when no CLI args are passed
// ---------------------------------------------------------------------------
const SCHEMAS_TO_CONVERT = [
  "employee",
  "periods",
  "shift",
  "demand",
  "employeeAvailabilityConstraint",
  "employeeUtilizationConstraint",
  "cooldownConstraint",
  "consecutiveConstraint",
  "patternConstraint",
  "periodicRestConstraint",
  "periodDistributionConstraint",
  // Add more schema names from openapi.no-deprecated.yml components.schemas
];

const apiRefDir = path.join(__dirname, "..");
const OPENAPI_FILE = path.join(apiRefDir, "openapi.no-deprecated.yml");
const SNIPPETS_API_DIR = path.join(apiRefDir, "..", "snippets", "api");

function loadSpec() {
  const content = fs.readFileSync(OPENAPI_FILE, "utf8");
  return yaml.parse(content);
}

function resolveRef(spec, ref) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("#/")) return null;
  const parts = ref.replace("#/", "").split("/");
  let current = spec;
  for (const p of parts) {
    current = current?.[p];
    if (current === undefined) return null;
  }
  return current;
}

function getRefName(ref) {
  if (!ref || typeof ref !== "string") return null;
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  return match ? match[1] : null;
}

/** Returns the schema after resolving $ref if present. */
function resolveSchema(spec, schema) {
  if (!schema) return null;
  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return resolved
      ? { ...resolved, __refName: getRefName(schema.$ref) }
      : schema;
  }
  return schema;
}

/** Get display type string for a schema (no $ref, already resolved or inline). */
function getTypeString(spec, schema, refName = null) {
  if (!schema) return "unknown";
  const rawType = Array.isArray(schema.type)
    ? schema.type.filter((t) => t !== "null")[0]
    : schema.type;

  if (schema.enum) {
    const enumStr = schema.enum.slice(0, 5).join(" | ");
    const more = schema.enum.length > 5 ? ` | ...` : "";
    return `string (enum: ${enumStr}${more})`;
  }

  if (rawType === "array") {
    const items = schema.items || {};
    const itemRef = items.$ref ? getRefName(items.$ref) : null;
    const itemResolved = items.$ref ? resolveRef(spec, items.$ref) : items;
    const isItemObject =
      itemResolved?.type === "object" && itemResolved?.properties;
    if (isItemObject) return "array of object";
    const itemType = itemRef
      ? itemRef
      : typeof itemResolved?.type === "string"
      ? itemResolved.type
      : "object";
    const format = itemResolved?.format ? ` (${itemResolved.format})` : "";
    return `array of ${itemType}${format}`;
  }

  if (rawType === "object") {
    return "object";
  }

  if (
    rawType === "string" ||
    rawType === "integer" ||
    rawType === "number" ||
    rawType === "boolean"
  ) {
    const format = schema.format ? ` (${schema.format})` : "";
    return `${rawType}${format}`;
  }

  if (refName) return refName;
  return rawType || "unknown";
}

/** Normalize description to a single line for use inside tags. */
function normalizeDescription(desc) {
  if (desc == null) return "";
  return String(desc).replace(/\s+/g, " ").trim();
}

/** Build type attribute for ResponseField (always show type). */
function typeAttr(typeStr) {
  return typeStr ? ` type="${typeStr}"` : "";
}

/** Build required attribute for ResponseField when true. */
function requiredAttr(required) {
  return required ? " required" : "";
}

const INDENT = "  ";

/**
 * Generate Mintlify markdown for one schema (object with properties).
 * Returns the inner content only (Expandable body); root ResponseField is added by caller.
 */
function schemaToExpandableContent(spec, schema, schemaName, indent = "") {
  const resolved = resolveSchema(spec, schema);
  if (!resolved) return "";

  const type = resolved.type;
  const isArray =
    type === "array" || (Array.isArray(type) && type.includes("array"));
  const isObject =
    type === "object" || (Array.isArray(type) && type.includes("object"));
  const props = resolved.properties;

  if (isObject && props && typeof props === "object") {
    const lines = [];
    const required = new Set(resolved.required || []);
    for (const [propName, propSchema] of Object.entries(props)) {
      const propResolved = resolveSchema(spec, propSchema);
      let propDesc = normalizeDescription(
        propResolved?.description || propSchema?.description
      );
      if (
        propDesc &&
        (propResolved?.default !== undefined ||
          propSchema?.default !== undefined)
      ) {
        const d = propResolved?.default ?? propSchema?.default;
        propDesc += ` Default: ${JSON.stringify(d)}.`;
      } else if (
        !propDesc &&
        (propResolved?.default !== undefined ||
          propSchema?.default !== undefined)
      ) {
        const d = propResolved?.default ?? propSchema?.default;
        propDesc = `Default: ${JSON.stringify(d)}.`;
      }
      const isRequired = required.has(propName);
      const typeStr = getTypeString(
        spec,
        propResolved || propSchema,
        propResolved?.__refName
      );

      const propIsObject =
        (propResolved?.type === "object" || propSchema?.$ref) &&
        (propResolved?.properties ||
          (propSchema?.$ref && resolveRef(spec, propSchema.$ref)?.properties));
      const propItems = propResolved?.items || propSchema?.items;
      const itemSchema = propItems?.$ref
        ? resolveRef(spec, propItems.$ref)
        : propItems;
      const propIsArrayOfObject =
        propResolved?.type === "array" && itemSchema?.properties;

      if (
        propIsObject &&
        (propResolved?.properties ||
          (propSchema?.$ref && resolveRef(spec, propSchema.$ref)?.properties))
      ) {
        const innerSchema = propResolved?.properties
          ? propResolved
          : resolveRef(spec, propSchema.$ref);
        const innerTypeName =
          propResolved?.__refName || getRefName(propSchema?.$ref) || "object";
        lines.push(
          `${indent}<ResponseField name="${propName}"${typeAttr(typeStr)}${requiredAttr(isRequired)}>`,
          `${indent}  ${normalizeDescription(propDesc)}`,
          `${indent}</ResponseField>`,
          `${indent}<Expandable title="${propName} – properties">`,
          ...schemaToExpandableContent(
            spec,
            innerSchema,
            propName,
            indent + INDENT
          ).split("\n"),
          `${indent}</Expandable>`
        );
      } else if (propIsArrayOfObject) {
        const arrTypeStr = getTypeString(spec, propResolved);
        lines.push(
          `${indent}<ResponseField name="${propName}"${typeAttr(arrTypeStr)}${requiredAttr(isRequired)}>`,
          `${indent}  ${propDesc}`,
          `${indent}</ResponseField>`,
          `${indent}<Expandable title="${propName} – item structure">`,
          ...schemaToExpandableContent(
            spec,
            itemSchema,
            "item",
            indent + INDENT
          )
            .split("\n")
            .filter(Boolean),
          `${indent}</Expandable>`
        );
      } else {
        lines.push(
          `${indent}<ResponseField name="${propName}"${typeAttr(typeStr)}${requiredAttr(isRequired)}>`,
          `${indent}  ${propDesc}`,
          `${indent}</ResponseField>`
        );
      }
    }
    return lines.join("\n");
  }

  return "";
}

/**
 * Generate full Mintlify snippet for one named schema (root ResponseField + optional Expandable).
 */
function schemaToMintlify(spec, schemaName) {
  const schema = spec.components?.schemas?.[schemaName];
  if (!schema) {
    return `<!-- Schema not found: ${schemaName} -->\n`;
  }

  const resolved = resolveSchema(spec, schema);
  const desc = normalizeDescription(
    resolved?.description || schema?.description
  );
  const typeStr = getTypeString(spec, resolved, schemaName);
  const hasProperties =
    resolved?.type === "object" &&
    resolved?.properties &&
    Object.keys(resolved.properties).length > 0;

  const lines = [];
  lines.push(`<ResponseField name="${schemaName}"${typeAttr(typeStr)}>`);
  if (desc) lines.push(`  ${desc}`);
  if (hasProperties) {
    lines.push(`  <Expandable title="properties">`);
    const inner = schemaToExpandableContent(spec, resolved, schemaName, "    ");
    lines.push(inner);
    lines.push(`  </Expandable>`);
  }
  lines.push(`</ResponseField>`);
  return lines.join("\n") + "\n";
}

function main() {
  const schemaNames =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : SCHEMAS_TO_CONVERT;
  const spec = loadSpec();

  fs.mkdirSync(SNIPPETS_API_DIR, { recursive: true });

  for (const name of schemaNames) {
    const mdx = schemaToMintlify(spec, name);
    const filePath = path.join(SNIPPETS_API_DIR, `${name}.mdx`);
    const content = mdx;
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Wrote ${filePath}`);
  }
}

main();
