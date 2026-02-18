---
title: Ensure Critical Queries Use Appropriate Indexes
impact: CRITICAL
impactDescription: "Use explain() to confirm query plans and avoid expensive scans on large or latency-sensitive workloads"
tags: index, collscan, ixscan, explain, performance-advisor, atlas-suggestion
---

## Ensure Critical Queries Use Appropriate Indexes

**For large collections and latency-sensitive paths, verify that queries use indexes.** A `COLLSCAN` reads many documents and can become a bottleneck as data grows. Use `explain("executionStats")` to confirm whether the chosen plan is efficient for your workload.

**Incorrect (assuming the planner chose a good path without checking):**

```javascript
db.orders.find({ customerId: "cust123" })

// No explain review, no visibility into scan volume.
```

**Correct (explain-driven index validation):**

```javascript
db.orders.createIndex({ customerId: 1 })

const exp = db.orders
  .find({ customerId: "cust123" })
  .explain("executionStats")

print(exp.queryPlanner.winningPlan.stage)
print(exp.executionStats.totalKeysExamined)
print(exp.executionStats.totalDocsExamined)
print(exp.executionStats.nReturned)
```

**What to check in `explain()`:**

| Metric | Healthy Direction | Risk Signal |
|--------|-------------------|-------------|
| Winning stage | Uses `IXSCAN` path for critical queries | `COLLSCAN` on large data |
| `totalDocsExamined / nReturned` | Close to 1 | Much larger than 1 |
| `totalKeysExamined / nReturned` | Low | Very high |
| `indexBounds` | Narrow bounds | Wide bounds (`MinKey`/`MaxKey`) |

**Important caveats:**

- Some scans are acceptable (small collections, broad low-selectivity queries, one-off admin jobs).
- Index use is not binary: a query can use an index but still be inefficient.
- For compound indexes, prefix and ESR alignment drive whether the plan stays selective.

**Finding scan-heavy queries:**

```javascript
// Example profiler check for recent COLLSCAN activity
db.system.profile.find({ planSummary: "COLLSCAN" })
  .sort({ ts: -1 })
  .limit(20)

// Atlas users: Performance Advisor is a strong first pass for missing-index candidates.
```

## Verify with

```javascript
function checkIndexUsage(queryCursor) {
  const explain = queryCursor.explain("executionStats")
  const stats = explain.executionStats
  const ratio = stats.totalDocsExamined / Math.max(stats.nReturned, 1)

  print(`docsExamined: ${stats.totalDocsExamined}`)
  print(`keysExamined: ${stats.totalKeysExamined}`)
  print(`nReturned: ${stats.nReturned}`)
  print(`examined/returned: ${ratio.toFixed(2)}`)

  if (ratio > 20) {
    print("Investigate index shape/selectivity for this query")
  }
}
```

Reference: [Analyze Query Performance](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)
