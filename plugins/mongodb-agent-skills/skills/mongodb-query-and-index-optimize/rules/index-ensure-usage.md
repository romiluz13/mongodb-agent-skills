---
title: Ensure Queries Use Indexes
impact: CRITICAL
impactDescription: "COLLSCAN on 10M docs = 45 seconds; IXSCAN = 2 milliseconds—22,000× difference"
tags: index, collscan, ixscan, explain, performance-advisor, atlas-suggestion
---

## Ensure Queries Use Indexes

**Every production query must use an index. No exceptions.** A COLLSCAN (collection scan) reads every document in the collection—linear O(n) time that kills performance as data grows. We've seen production systems brought down by a single missing index. This is the most common cause of MongoDB performance problems.

**Incorrect (no index—COLLSCAN death spiral):**

```javascript
// Query on field without index
db.orders.find({ customerId: "cust123" })

// explain("executionStats") reveals the horror:
{
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 47,                    // Only wanted 47 docs
    "executionTimeMillis": 45000,       // 45 SECONDS
    "totalKeysExamined": 0,             // No index used
    "totalDocsExamined": 10000000       // Read ALL 10M documents
  },
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN",              // FULL COLLECTION SCAN
      "direction": "forward"
    }
  }
}

// Why this kills your app:
// - 45 seconds per query = timeout errors
// - Reads 10M docs from disk = saturates I/O
// - Holds locks = blocks other operations
// - Under load = cascading failures
```

**Correct (indexed query—IXSCAN):**

```javascript
// Create the index
db.orders.createIndex({ customerId: 1 })
// Build time: ~1 min for 10M docs (one-time cost)

// Same query, now indexed
db.orders.find({ customerId: "cust123" })

// explain("executionStats") shows:
{
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 47,                    // Same 47 docs
    "executionTimeMillis": 2,           // 2 MILLISECONDS (22,000× faster)
    "totalKeysExamined": 47,            // Examined only matching keys
    "totalDocsExamined": 47             // Fetched only matching docs
  },
  "queryPlanner": {
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",              // INDEX SCAN
        "indexName": "customerId_1",
        "indexBounds": {
          "customerId": ["[\"cust123\", \"cust123\"]"]
        }
      }
    }
  }
}
```

**The explain() command—your diagnostic tool:**

```javascript
// Three verbosity levels:
db.orders.find({ customerId: "x" }).explain()                    // queryPlanner only
db.orders.find({ customerId: "x" }).explain("executionStats")    // + actual execution
db.orders.find({ customerId: "x" }).explain("allPlansExecution") // + rejected plans

// ALWAYS use "executionStats" for real diagnostics
// It actually runs the query and shows real numbers
```

**Key metrics to check in explain():**

| Metric | Healthy | Problem | What It Means |
|--------|---------|---------|---------------|
| `stage` | `IXSCAN` | `COLLSCAN` | No index → full scan |
| `totalDocsExamined / nReturned` | ~1 | >>1 | Examining docs that don't match |
| `totalKeysExamined / nReturned` | 1-2 | >>10 | Index not selective enough |
| `executionTimeMillis` | <100 | >1000 | Query is too slow |
| `indexBounds` | Tight ranges | `[MinKey, MaxKey]` | Index used but not efficiently |

**Compound index prefix rule (critical to understand):**

```javascript
// Index: { a: 1, b: 1, c: 1 }
// This index can satisfy queries on:

db.col.find({ a: "x" })                    // YES - uses prefix {a}
db.col.find({ a: "x", b: "y" })            // YES - uses prefix {a, b}
db.col.find({ a: "x", b: "y", c: "z" })    // YES - uses full index
db.col.find({ a: "x", c: "z" })            // PARTIAL - uses {a}, scans for c

// These CANNOT use the index:
db.col.find({ b: "y" })                    // NO - a not present
db.col.find({ c: "z" })                    // NO - a, b not present
db.col.find({ b: "y", c: "z" })            // NO - a not present

// Index fields must be used LEFT TO RIGHT
// You can skip trailing fields but not leading ones
```

**Finding missing indexes—production audit:**

```javascript
// Method 1: Check slow query log
db.setProfilingLevel(1, { slowms: 100 })  // Log queries >100ms
db.system.profile.find({
  "command.filter": { $exists: true },
  "planSummary": "COLLSCAN"
}).sort({ ts: -1 }).limit(20)

// Method 2: Aggregate COLLSCAN queries from profile
db.system.profile.aggregate([
  { $match: { planSummary: "COLLSCAN" } },
  { $group: {
    _id: { ns: "$ns", filter: "$command.filter" },
    count: { $sum: 1 },
    avgMs: { $avg: "$millis" }
  }},
  { $sort: { count: -1 } }
])

// Method 3: Atlas Performance Advisor (recommended)
// Automatically analyzes slow queries and suggests indexes
// Shows estimated improvement for each suggestion
```

**When NOT to expect index usage:**

- **Tiny collections**: <1000 docs, COLLSCAN may be faster than index lookup overhead.
- **Returning most documents**: If query matches >30% of collection, COLLSCAN can win.
- **$where and $text without index**: These have special requirements.
- **Negation operators alone**: `{ field: { $ne: value } }` rarely uses indexes well.

**Verify with:**

```javascript
// Quick check: Is my query using an index?
function checkIndexUsage(query) {
  const explain = query.explain("executionStats")
  const stage = explain.queryPlanner.winningPlan.stage ||
                explain.queryPlanner.winningPlan.inputStage?.stage

  const stats = explain.executionStats
  const ratio = stats.totalDocsExamined / Math.max(stats.nReturned, 1)

  print(`Stage: ${stage}`)
  print(`Docs examined: ${stats.totalDocsExamined}`)
  print(`Docs returned: ${stats.nReturned}`)
  print(`Efficiency ratio: ${ratio.toFixed(2)}`)
  print(`Time: ${stats.executionTimeMillis}ms`)

  if (stage === "COLLSCAN") {
    print("⚠️  COLLSCAN detected - create an index!")
  } else if (ratio > 10) {
    print("⚠️  Index exists but not selective - check field order")
  } else {
    print("✓ Query is using index efficiently")
  }
}

// Usage:
checkIndexUsage(db.orders.find({ customerId: "cust123" }))
```

Reference: [Analyze Query Performance](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)
