# API reference

## Updating the API

When you have a new `openapi.yml`, run:

```bash
cd api-reference
npm install
npm run update-api
```

This single script:

1. **Strip deprecated** — Reads `openapi.yml`, removes deprecated fields and sets wide mode, writes `openapi.no-deprecated.yml`.
2. **Schema snippets** — Generates Mintlify `ResponseField` / `Expandable` snippets from the schemas listed in `scripts/schema-to-mintlify.js` (`SCHEMAS_TO_CONVERT`) and writes them to **`snippets/api/`** as `{schemaName}.mdx`.

To change which schemas get snippets, edit `SCHEMAS_TO_CONVERT` in `scripts/schema-to-mintlify.js`. Schema names must match keys under `components.schemas` in the OpenAPI spec.

### Running steps individually

The logic lives in `scripts/` so you can run steps separately if needed:

- `node scripts/strip-deprecated.js` — strip only (default: `openapi.yml` → `openapi.no-deprecated.yml`)
- `node scripts/strip-deprecated.js input.yml output.yml` — custom in/out
- `node scripts/schema-to-mintlify.js [schema1] [schema2] ...` — snippets only (default: uses `SCHEMAS_TO_CONVERT`)
