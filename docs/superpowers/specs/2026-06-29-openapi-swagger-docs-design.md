# OpenAPI/Swagger Documentation — Schema Injection Design

## Problem

Backend has `@fastify/swagger` + `@fastify/swagger-ui` registered but most routes lack Fastify `schema` definitions. Swagger UI shows endpoints with no request/response documentation.

## Approach

Use `zod-to-json-schema` to convert existing Zod schemas into Fastify JSON Schema objects, avoiding duplication.

## Architecture

### 1. Helper utility (`backend/src/utils/schemaHelper.js`)

```js
const { zodToJsonSchema } = require('zod-to-json-schema');

function toSchema(zodObj) {
  const raw = zodToJsonSchema(zodObj, { target: 'openApi3' });
  return raw.definitions?.default ?? raw;
}
```

### 2. Route changes

Every route gets at minimum `{ tags: ['Module'], description: '...' }`.
Routes with existing Zod schemas get converted to Fastify `schema.body`, `schema.querystring`, or `schema.params`.

### 3. Scope

- **Do**: Add schemas to 20 route files
- **Skip**: `response` schemas (future work)
- **Keep**: Existing inline JSON Schema routes as-is (auth, departments, hierarchy, etc.)

### 4. Phases

| Phase | Files                                                                                                                             | Change                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| A     | analytics, ai, audit, meetings, notices, notifications, proof-submissions, reports, reports/export, sessions, uploads, uptoskills | Full schema from Zod                        |
| B     | users, team (partial), auth (csrf-token)                                                                                          | Add missing schemas                         |
| C     | attendance, hierarchy, ratings, social-tasks                                                                                      | Already have tags+description — verify only |
