---
title: Use $queryStats to Analyze Query Patterns
impact: MEDIUM
impactDescription: "Identify slow queries and missing indexes from real workload data"
tags: queryStats, diagnostics, performance, MongoDB-8.0, optimization
---

## Use $queryStats to Analyze Query Patterns

**MongoDB 8.0 introduced `$queryStats`**, an aggregation stage that provides statistics about queries executed on your cluster. Use it to identify slow queries, missing indexes, and optimization opportunities based on actual workload data.

**Incorrect (guessing which queries need optimization):**

```javascript
// Manually checking individual queries without workload data
db.orders.explain("executionStats").find({ status: "pending" })
// Problem: Don't know which queries are actually frequent or slow
// Could optimize a query that runs once a day instead of one running 1000x/minute
```

**Correct (data-driven query analysis):**

```javascript
// Get query statistics from the cluster
// Requires readAnyDatabase or clusterMonitor role
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $group: {
        _id: "$key.queryShape",
        namespace: { $first: "$key.queryShape.cmdNs" },
        totalExecutions: { $sum: "$metrics.execCount" },
        totalDuration: { $sum: "$metrics.totalExecMicros" },
        avgDurationMs: {
          $avg: { $divide: ["$metrics.totalExecMicros", 1000] }
        },
        docsExaminedTotal: { $sum: "$metrics.docsExamined.sum" },
        keysExaminedTotal: { $sum: "$metrics.keysExamined.sum" }
      }
    },
    { $sort: { totalDuration: -1 } },
    { $limit: 10 }
  ],
  cursor: {}
})
// Returns top 10 query shapes by total time spent
```

**Find queries with poor index usage:**

```javascript
// Queries examining many documents relative to results
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $match: {
        "metrics.execCount": { $gt: 100 }  // Frequently executed
      }
    },
    {
      $project: {
        namespace: "$key.queryShape.cmdNs",
        queryShape: "$key.queryShape",
        execCount: "$metrics.execCount",
        avgDocsExamined: {
          $divide: ["$metrics.docsExamined.sum", "$metrics.execCount"]
        },
        avgDocsReturned: {
          $divide: ["$metrics.docsReturned.sum", "$metrics.execCount"]
        },
        scanRatio: {
          $cond: {
            if: { $eq: ["$metrics.docsReturned.sum", 0] },
            then: null,
            else: {
              $divide: [
                "$metrics.docsExamined.sum",
                "$metrics.docsReturned.sum"
              ]
            }
          }
        }
      }
    },
    { $match: { scanRatio: { $gt: 100 } } },  // Examining 100x more than returning
    { $sort: { scanRatio: -1 } },
    { $limit: 20 }
  ],
  cursor: {}
})
// High scanRatio = likely missing index
```

**Monitor query latency distribution:**

```javascript
// Get latency percentiles for query shapes
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $project: {
        namespace: "$key.queryShape.cmdNs",
        command: "$key.queryShape.command",
        execCount: "$metrics.execCount",
        p50Ms: { $divide: ["$metrics.execMicros.p50", 1000] },
        p95Ms: { $divide: ["$metrics.execMicros.p95", 1000] },
        p99Ms: { $divide: ["$metrics.execMicros.p99", 1000] }
      }
    },
    { $match: { "p99Ms": { $gt: 100 } } },  // p99 > 100ms
    { $sort: { p99Ms: -1 } }
  ],
  cursor: {}
})
```

**Reset statistics for fresh analysis:**

```javascript
// Clear query stats to analyze recent workload only
db.adminCommand({ queryAnalyzers: 1, mode: "off" })
db.adminCommand({ queryAnalyzers: 1, mode: "full" })
// Wait for new workload data to accumulate
```

**When NOT to use this pattern:**

- **Pre-MongoDB 8.0**: This stage doesn't exist in earlier versions.
- **Immediate debugging**: Use explain() for single query analysis.
- **Free tier clusters**: May have limited $queryStats access.

Reference: [$queryStats](https://mongodb.com/docs/manual/reference/operator/aggregation/queryStats/)
