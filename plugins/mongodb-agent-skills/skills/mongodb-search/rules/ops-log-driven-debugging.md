---
title: Debug with Explain, Metrics, and Process Health Signals
impact: HIGH
impactDescription: Prevents guesswork during relevance and latency incidents
tags: debugging, explain, metrics, health
---

## Debug with Explain, Metrics, and Process Health Signals

**Impact: HIGH (guesswork tuning wastes time and can worsen ranking)**

Use a repeatable debugging stack: query `explain`, Search metrics, alert context, and process health checks (`mongot` for Community).

**Incorrect (blind parameter tweaking):**

```text
"Increase boost, change analyzers, and retry until it looks okay."
```

**Correct (signal-driven debug loop):**

```javascript
db.movies.explain("executionStats").aggregate([
  { $search: { text: { query: "history", path: "plot" } } },
  { $limit: 10 }
])
```

```text
Then correlate with Search metrics and active alerts before changing mappings.
```

## Relevance Debugging: scoreDetails

For relevance debugging (wrong ranking, unexpected scores):
- `explain()` shows query plan and index usage
- `scoreDetails` shows per-operator score contributions

Use both together: `explain()` to diagnose index problems, `scoreDetails` to diagnose scoring.

```javascript
db.collection.aggregate([
  { $search: {
    compound: { must: [{ text: { query: "atlas", path: "title" } }] },
    scoreDetails: true
  }},
  { $project: {
    title: 1,
    score: { $meta: "searchScore" },
    details: { $meta: "searchScoreDetails" }
  }}
])
```

**How to verify:**

- Every tuning change is tied to explain/metric evidence.
- Incident notes include pre-change and post-change measurements.

**When NOT to use this pattern:**

- Trivial sandbox experiments where no reliability target exists.

Reference: [Search Explain](https://www.mongodb.com/docs/atlas/atlas-search/explain.md)
Reference: [Monitor Atlas Search](https://www.mongodb.com/docs/atlas/atlas-search/monitoring.md)
Reference: [Review Atlas Search Metrics](https://www.mongodb.com/docs/atlas/review-atlas-search-metrics.md)
