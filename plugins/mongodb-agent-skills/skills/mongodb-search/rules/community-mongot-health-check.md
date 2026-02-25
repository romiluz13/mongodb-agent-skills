---
title: Verify mongot Health Before Search Query Tuning
impact: CRITICAL
impactDescription: Prevents wasted query tuning when Search process is unavailable
tags: community, mongot, health, diagnostics
---

## Verify mongot Health Before Search Query Tuning

**Impact: CRITICAL (query tuning is pointless if `mongot` is down or indexes are not ready)**

Before analyzing relevance or latency, confirm `mongot` process health and basic queryability.

**Incorrect (jumping into analyzer tuning first):**

```javascript
// WRONG: tuning query semantics before confirming process health
db.movies.aggregate([{ $search: { text: { query: "space", path: "title" } } }])
```

**Correct (health-first sequence):**

```bash
# 1) Verify mongot process health
curl localhost:8080/health
# Expected: SERVING
```

```javascript
// 2) Verify basic search command path
db.runCommand({ listSearchIndexes: "movies" })
```

**How to verify:**

- `/health` returns `SERVING`.
- `listSearchIndexes` succeeds from connected client.

**When NOT to use this pattern:**

- Atlas deployment where process health is managed and already validated by platform status.

Reference: [Connect to MongoDB Search Community](https://www.mongodb.com/docs/manual/core/search-in-community/connect-to-search.md)
Reference: [Verify Integrity of mongot Packages](https://www.mongodb.com/docs/manual/core/search-in-community/verify-mongot-packages.md)
