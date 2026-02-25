---
title: Triage Index Status Before Rebuilding
impact: HIGH
impactDescription: Avoids destructive rebuild loops and shortens recovery time
tags: index-status, failed, stale, triage
---

## Triage Index Status Before Rebuilding

**Impact: HIGH (blind rebuilds can amplify downtime and cost)**

Inspect index status (`Pending`, `Building`, `Ready`, `Stale`, `Failed`) and status details before taking rebuild actions.

**Incorrect (drop and recreate immediately):**

```javascript
// WRONG: destructive loop without status analysis
db.movies.dropSearchIndex("default")
db.movies.createSearchIndex("default", { mappings: { dynamic: true } })
```

**Correct (status-driven triage):**

```text
1) Read status details and node-level error.
2) Classify: config error, disk pressure, replication lag, oplog fall-off.
3) Apply targeted fix (definition, capacity, replication health).
4) Rebuild only after root cause is controlled.
```

**How to verify:**

- Triage notes include status and root cause classification.
- Rebuilds happen only after identified blockers are resolved.

**When NOT to use this pattern:**

- None. Status inspection is mandatory before rebuild decisions.

Reference: [Manage Search Indexes](https://www.mongodb.com/docs/atlas/atlas-search/manage-indexes.md)
Reference: [Fix Atlas Search Issues](https://www.mongodb.com/docs/atlas/reference/alert-resolutions/atlas-search-alerts.md)
