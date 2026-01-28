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
