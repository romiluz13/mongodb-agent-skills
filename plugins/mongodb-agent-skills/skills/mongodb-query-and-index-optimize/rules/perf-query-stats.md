---
title: Use $queryStats to Analyze Query Patterns
impact: MEDIUM
impactDescription: "Identify slow queries and missing indexes from real workload data"
tags: queryStats, diagnostics, performance, Atlas, optimization
---

## Use $queryStats to Analyze Query Patterns

**`$queryStats` provides workload-level query telemetry** to identify slow query shapes, poor index usage, and optimization opportunities from real traffic. It is available on Atlas M10+ (introduced in MongoDB 6.0.7) and includes additional metrics in newer versions (for example, new fields added in 8.2).

**Version-specific coverage to account for in analysis:**

- **MongoDB 8.1+**: query stats are reported for `count` and `distinct` commands in addition to `find`/`aggregate`.
- **MongoDB 8.2+**: additional ticket-delinquency metrics and `cpuNanos` metrics are available (`cpuNanos` on Linux only).
- **Stability caveat**: treat `$queryStats` output as release-sensitive diagnostics data and avoid hard-coding brittle parsers against a fixed field contract.

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
// Requires queryStatsRead privilege (clusterMonitor includes it)
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $group: {
        _id: "$key.queryShape",
        namespace: { $first: "$key.queryShape.cmdNs" },
        totalExecutions: { $sum: "$metrics.execCount" },
        totalDurationMicros: { $sum: "$metrics.totalExecMicros.sum" },
        docsExaminedTotal: { $sum: "$metrics.docsExamined.sum" },
        keysExaminedTotal: { $sum: "$metrics.keysExamined.sum" }
      }
    },
    {
      $project: {
        namespace: 1,
        totalExecutions: 1,
        totalDurationMicros: 1,
        docsExaminedTotal: 1,
        keysExaminedTotal: 1,
        avgDurationMs: {
          $cond: {
            if: { $gt: ["$totalExecutions", 0] },
            then: {
              $divide: [
                "$totalDurationMicros",
                { $multiply: ["$totalExecutions", 1000] }
              ]
            },
            else: null
          }
        }
      }
    },
    { $sort: { totalDurationMicros: -1 } },
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

**Check command coverage (including `count` and `distinct` on 8.1+):**

```javascript
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $group: {
        _id: "$key.queryShape.command",
        shapes: { $sum: 1 },
        executions: { $sum: "$metrics.execCount" }
      }
    },
    { $sort: { executions: -1 } }
  ],
  cursor: {}
})
// Expect find/aggregate and, on 8.1+, distinct/count shapes as well
```

**Monitor latency outliers and recent regressions:**

```javascript
// Focus on high-latency query shapes and when they were last seen
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $project: {
        namespace: "$key.queryShape.cmdNs",
        command: "$key.queryShape.command",
        execCount: "$metrics.execCount",
        avgExecMs: {
          $cond: {
            if: { $gt: ["$metrics.execCount", 0] },
            then: {
              $divide: [
                "$metrics.totalExecMicros.sum",
                { $multiply: ["$metrics.execCount", 1000] }
              ]
            },
            else: null
          }
        },
        maxExecMs: { $divide: ["$metrics.totalExecMicros.max", 1000] },
        latestSeen: "$metrics.latestSeenTimestamp"
      }
    },
    { $match: { maxExecMs: { $gt: 100 } } },  // Slow outliers
    { $sort: { maxExecMs: -1 } }
  ],
  cursor: {}
})
```

**Use 8.2+ ticket/CPU metrics for deeper diagnosis:**

```javascript
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $project: {
        namespace: "$key.queryShape.cmdNs",
        command: "$key.queryShape.command",
        execCount: "$metrics.execCount",
        delinquentAcquisitions: "$metrics.delinquentAcquisitions",
        totalAcqDelinquencyMs: "$metrics.totalAcquisitionDelinquencyMillis",
        maxAcqDelinquencyMs: "$metrics.maxAcquisitionDelinquencyMillis",
        totalCpuMs: {
          $cond: {
            if: { $ifNull: ["$metrics.cpuNanos.sum", false] },
            then: { $divide: ["$metrics.cpuNanos.sum", 1000000] },
            else: null
          }
        }
      }
    },
    {
      $match: {
        $or: [
          { delinquentAcquisitions: { $gt: 0 } },
          { maxAcqDelinquencyMs: { $gt: 50 } }
        ]
      }
    },
    { $sort: { maxAcqDelinquencyMs: -1 } }
  ],
  cursor: {}
})
```

**Build a fresh analysis window (without resetting server state):**

```javascript
const analysisStart = new Date()

// Run workload...

db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $queryStats: {} },
    {
      $match: {
        "metrics.latestSeenTimestamp": { $gte: analysisStart }
      }
    }
  ],
  cursor: {}
})
// Use latestSeenTimestamp / firstSeenTimestamp to scope the period you care about
```

**When NOT to use this pattern:**

- **Unsupported deployments**: Requires Atlas M10+ (available since MongoDB 6.0.7).
- **Immediate debugging**: Use explain() for single query analysis.
- **Need hard-reset semantics**: Use bounded time windows for analysis; there is no documented `$queryStats` reset command.
- **Relying on 8.2-only metrics in older versions**: Gate use of `cpuNanos`/delinquency fields by server version.
- **Strict schema-contract telemetry needs**: Prefer more stable observability exports when parser stability is mandatory.


## Verify with

1. Run representative queries with `explain("executionStats")` before and after applying this rule.
2. Compare latency and scan efficiency (`totalDocsExamined`, `totalKeysExamined`, `nReturned`).
3. Confirm workload-level behavior using `$queryStats`, profiler, or Atlas Performance Advisor.

Reference: [$queryStats](https://mongodb.com/docs/manual/reference/operator/aggregation/queryStats/)
