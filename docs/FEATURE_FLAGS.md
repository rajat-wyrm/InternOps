# Feature Flags — Developer Guide

InternOps uses an **in-house, config-file + database-backed feature flag system**.  
Flags can be toggled without a redeploy and take effect within 30 seconds  
(or immediately for Admin actions via the kill-switch API).

---

## Table of Contents

1. [Architecture](#architecture)
2. [Adding a New Flag](#adding-a-new-flag)
3. [Using Flags in the Backend](#using-flags-in-the-backend)
4. [Using Flags in the Frontend](#using-flags-in-the-frontend)
5. [Admin UI](#admin-ui)
6. [REST API Reference](#rest-api-reference)
7. [Kill-Switch Procedure](#kill-switch-procedure)
8. [Percentage-Based Rollout](#percentage-based-rollout)
9. [Role-Restricted Flags](#role-restricted-flags)
10. [Evaluation Priority](#evaluation-priority)
11. [Cache](#cache)

---

## Architecture

```
flags.config.js  ← static registry of all known flags & defaults
      ↓
feature_flags DB table  ← runtime overrides (enabled, rollout_pct, allowed_roles)
      ↓
service.js (LRU cache)  ← evaluation engine (merge config + DB)
      ↓
/api/v1/feature-flags   ← REST API
      ↓
Zustand store (frontend) ← boot-fetched once after auth
      ↓
useFeatureFlag / <FeatureGate>  ← consumed in React components
```

---

## Adding a New Flag

### Step 1 — Register in `flags.config.js`

```js
// backend/src/modules/feature-flags/flags.config.js
module.exports = {
  // ... existing flags ...

  MY_NEW_FEATURE: {
    defaultEnabled: false, // off until explicitly enabled
    description: 'Description of what this flag controls',
    rolloutPct: 100, // default: all users
  },
};
```

> **Rule**: Every flag used in code MUST have an entry here.  
> Unknown keys are always evaluated as `false`.

### Step 2 — Add a DB Migration

Create `backend/migrations/027_add_my_new_feature_flag.sql`:

```sql
INSERT INTO feature_flags (key, enabled, rollout_pct, description)
VALUES ('MY_NEW_FEATURE', FALSE, 100, 'Description of what this flag controls')
ON CONFLICT (key) DO NOTHING;
```

Run it:

```bash
cd backend
npm run migrate
```

---

## Using Flags in the Backend

### Option A — In a service / handler

```js
const service = require('../feature-flags/service');

// Inside an async function:
const enabled = await service.isEnabled('MY_NEW_FEATURE', req.user);
if (!enabled) {
  return reply.status(404).send({ error: 'Not Found' });
}
```

### Option B — Route-level middleware guard

The `featureFlagMiddleware` blocks the entire route and returns `404`
when the flag is off (the feature simply "doesn't exist" for that user).

```js
// In any routes.js file:
const featureFlagMiddleware = require('../../middleware/featureFlag');
const authenticate = require('../../middleware/auth');

fastify.get(
  '/my-route',
  {
    preHandler: [authenticate, featureFlagMiddleware('MY_NEW_FEATURE')],
  },
  async (req, reply) => {
    // Only reached when MY_NEW_FEATURE is ON for req.user
    reply.send({ data: '...' });
  }
);
```

---

## Using Flags in the Frontend

### `useFeatureFlag` hook

```jsx
import useFeatureFlag from '../hooks/useFeatureFlag';

export default function MyComponent() {
  const showNewUI = useFeatureFlag('MY_NEW_FEATURE');

  if (!showNewUI) return <OldComponent />;
  return <NewComponent />;
}
```

### `<FeatureGate>` component

```jsx
import FeatureGate from '../components/FeatureGate';

// Simple guard — renders nothing when flag is off
<FeatureGate flag="MY_NEW_FEATURE">
  <NewComponent />
</FeatureGate>

// With fallback
<FeatureGate flag="MY_NEW_FEATURE" fallback={<OldComponent />}>
  <NewComponent />
</FeatureGate>
```

### Manually checking in store

```js
import useFeatureFlagsStore from '../store/featureFlags';

const isEnabled = useFeatureFlagsStore.getState().isEnabled('MY_NEW_FEATURE');
```

---

## Admin UI

Navigate to `/feature-flags` (ADMIN role required).

The page provides:

- **Stats bar** — total / enabled / disabled count
- **Flag cards** — one per flag, showing status, rollout %, role restrictions
- **Edit modal** — toggle enabled, set rollout %, pick allowed roles, update description
- **Kill-switch button** — instantly disables the flag (red "Kill" button)
- **Enable button** — re-enables a previously disabled flag
- **Refresh button** — re-syncs both the admin table and the Zustand store

---

## REST API Reference

Base path: `/api/v1/feature-flags`

| Method | Path            | Auth              | Description                                   |
| ------ | --------------- | ----------------- | --------------------------------------------- |
| `GET`  | `/`             | Any authenticated | Boolean map of all flags for the calling user |
| `GET`  | `/definitions`  | ADMIN             | Full DB rows with metadata (used by Admin UI) |
| `GET`  | `/:key`         | Any authenticated | Single flag evaluation for calling user       |
| `PUT`  | `/:key`         | ADMIN             | Update flag (partial, merges with existing)   |
| `POST` | `/:key/disable` | ADMIN             | Kill-switch — instantly disables              |
| `POST` | `/:key/enable`  | ADMIN             | Re-enable a disabled flag                     |

### `PUT /:key` body schema

```json
{
  "enabled": true,
  "rolloutPct": 50,
  "allowedRoles": ["ADMIN", "SENIOR_TL"],
  "description": "Updated description"
}
```

All fields are optional — unspecified fields retain their current value.

---

## Kill-Switch Procedure

When a feature is causing incidents:

1. **Via Admin UI** — go to `/feature-flags`, find the flag, click the red **Kill** button. Done.

2. **Via API** (e.g., from a terminal / incident runbook):

   ```bash
   curl -X POST https://your-api/api/v1/feature-flags/MY_NEW_FEATURE/disable \
     -H "Authorization: Bearer <admin_token>" \
     -H "X-CSRF-Token: <csrf_token>"
   ```

3. **Via database** (last resort if API is down):
   ```sql
   UPDATE feature_flags SET enabled = FALSE, updated_at = NOW()
   WHERE key = 'MY_NEW_FEATURE';
   ```
   > After a DB-direct update, the LRU cache will reflect the change within 30 seconds automatically.

The kill-switch also **invalidates the LRU cache immediately**, so all new
requests see the change in the same request cycle — not after the 30 s TTL.

---

## Percentage-Based Rollout

`rollout_pct` (0–100) controls what fraction of users see the feature.

**How it works:**  
A SHA-256 hash of `userId + flagKey` is computed, producing a deterministic
0–100 "bucket" value. If the bucket is < `rollout_pct`, the feature is on.

- Same user always lands in the same bucket for the same flag.
- Different flags produce different bucket assignments for the same user.
- Anonymous (unauthenticated) users are excluded from percentage rollouts.

**Example: staged rollout to 10% then 50% then 100%:**

```bash
# 10% of users
curl -X PUT .../feature-flags/MY_NEW_FEATURE -d '{"rolloutPct": 10}'

# After validation, expand to 50%
curl -X PUT .../feature-flags/MY_NEW_FEATURE -d '{"rolloutPct": 50}'

# Full rollout
curl -X PUT .../feature-flags/MY_NEW_FEATURE -d '{"rolloutPct": 100}'
```

---

## Role-Restricted Flags

`allowed_roles` is a JSON array of role strings, or `null` (meaning all roles).

**Example: internal beta for ADMIN and SENIOR_TL only:**

```bash
curl -X PUT .../feature-flags/MY_NEW_FEATURE \
  -d '{"enabled": true, "allowedRoles": ["ADMIN", "SENIOR_TL"]}'
```

**Remove restriction (allow all roles):**

```bash
curl -X PUT .../feature-flags/MY_NEW_FEATURE -d '{"allowedRoles": null}'
```

Valid role values: `ADMIN`, `SENIOR_TL`, `TL`, `CAPTAIN`, `INTERN`

---

## Evaluation Priority

When `isEnabled(key, user)` is called:

1. **Flag not in `flags.config.js`** → always `false`
2. **DB `enabled = false`** → `false` (kill-switch overrides everything)
3. **`allowed_roles` set and user role not in list** → `false`
4. **`rollout_pct < 100` and user's hash bucket >= `rollout_pct`** → `false`
5. **All checks pass** → `true`

---

## Cache

- Flag DB rows are cached in memory using `lru-cache` with a **30-second TTL**.
- After any `PUT` or `POST /disable|enable` via the API, the cache for that key is **immediately invalidated** — zero latency for admin actions.
- After a direct DB update (last-resort), changes propagate within 30 seconds.
- To force an immediate re-sync from the frontend, call the **Refresh** button on the Admin UI page, which calls `refreshStore()` → re-fetches `/api/v1/feature-flags`.
