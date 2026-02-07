# API reference

## Stripping deprecated fields

After dropping in a new `openapi.yml`, you can generate a copy without deprecated fields:

```bash
cd api-reference
npm install
npm run strip-deprecated
```

This reads `openapi.yml` and writes `openapi.no-deprecated.yml`.

**Other usage:**

- Custom input: `node strip-deprecated.js path/to/spec.yml`
- Custom output: `node strip-deprecated.js openapi.yml output.yml`

## Mintlify schema snippets

To generate Mintlify `ResponseField` / `Expandable` markdown snippets from OpenAPI schemas:

```bash
node schema-to-mintlify.js [schema1] [schema2] ...
```

- Schema names are the keys under `components.schemas` in `openapi.no-deprecated.yml` (e.g. `employee`, `duration`, `job`).
- If you omit schema names, the script uses the default list in `schema-to-mintlify.js` (edit `SCHEMAS_TO_CONVERT`).
- Snippets are written to **`snippets/api/`** as `{schemaName}.mdx` (e.g. `snippets/api/employee.mdx`). You can include them in MDX with Mintlify’s snippet syntax.
