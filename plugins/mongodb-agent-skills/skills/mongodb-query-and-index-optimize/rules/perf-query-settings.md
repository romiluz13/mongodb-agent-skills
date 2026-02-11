---
title: Use Query Settings to Override Query Plans
impact: MEDIUM
impactDescription: "Persistently force index usage without application code changes"
tags: querySettings, hint, plan, index, MongoDB-8.0, optimization
---

## Use Query Settings to Override Query Plans

**MongoDB 8.0 introduced Query Settings**, a way to persistently associate index hints and other settings with query shapes. Unlike `hint()` which requires application code changes, query settings apply automatically to matching queries cluster-wide.

Starting in MongoDB 8.0, query settings are the preferred replacement for deprecated index filters.

**Incorrect (hardcoding hints in application):**

```javascript
// Application code must be modified for every hint
// Hint is lost if query is written differently
db.orders.find({ status: "pending", region: "us-east" })
  .hint({ status: 1, region: 1, createdAt: -1 })

// Problem: Every query location needs updating
// Different query variations may not get the hint
```

**Correct (persistent query settings):**

```javascript
// Set index hint for a query shape - applies cluster-wide
db.adminCommand({
  setQuerySettings: {
    find: "orders",
    filter: { status: { $eq: {} }, region: { $eq: {} } },
    $db: "mydb"
  },
  settings: {
    indexHints: {
      ns: { db: "mydb", coll: "orders" },
      allowedIndexes: [{ status: 1, region: 1, createdAt: -1 }]
    },
    comment: "force compound index for regional order-status query shape"
  }
})

// Now ANY query matching this shape uses the specified index
db.orders.find({ status: "pending", region: "us-east" })  // Uses hint
db.orders.find({ status: "shipped", region: "eu-west" })   // Uses hint
// No application code changes needed
```

**Version note for `settings.comment`:**

```javascript
// `settings.comment` is available starting in MongoDB 8.1
// and in MongoDB 8.0.4+ patch releases
db.adminCommand({
  setQuerySettings: {
    find: "orders",
    filter: { status: { $eq: {} } },
    $db: "mydb"
  },
  settings: {
    reject: false,
    comment: { reason: "temporary routing during index rollout", owner: "db-team" }
  }
})
```

**Migrate from index filters to query settings:**

```javascript
// Legacy (deprecated in MongoDB 8.0): plan cache index filters
db.runCommand({
  planCacheSetFilter: "orders",
  query: { status: { $exists: true } },
  sort: { createdAt: -1 },
  indexes: ["status_1_createdAt_-1"]
})

// Preferred: persistent, cluster-scoped query settings
db.adminCommand({
  setQuerySettings: {
    find: "orders",
    filter: { status: { $eq: {} } },
    sort: { createdAt: -1 },
    $db: "mydb"
  },
  settings: {
    indexHints: {
      ns: { db: "mydb", coll: "orders" },
      allowedIndexes: ["status_1_createdAt_-1"]
    }
  }
})
```

**Query shapes use placeholders:**

```javascript
// The query shape abstracts literal values
// This setQuerySettings:
{
  find: "users",
  filter: { status: { $eq: {} }, age: { $gte: {} } },
  $db: "mydb"
}

// Matches all of these queries:
db.users.find({ status: "active", age: { $gte: 18 } })
db.users.find({ status: "inactive", age: { $gte: 65 } })
db.users.find({ status: "pending", age: { $gte: 0 } })
// All will use the configured index
```

**View current query settings:**

```javascript
// List all query settings
db.adminCommand({ aggregate: 1, pipeline: [{ $querySettings: {} }], cursor: {} })

// Get settings for a specific query shape
db.adminCommand({
  aggregate: 1,
  pipeline: [
    { $querySettings: {} },
    { $match: { "representativeQuery.find": "orders" } }
  ],
  cursor: {}
})
```

**Remove query settings:**

```javascript
// Remove settings by query shape hash
db.adminCommand({
  removeQuerySettings: {
    find: "orders",
    filter: { status: { $eq: {} }, region: { $eq: {} } },
    $db: "mydb"
  }
})

// Or use the queryShapeHash from $querySettings output
db.adminCommand({
  removeQuerySettings: "<queryShapeHash>"
})
```

**Reject problematic queries:**

```javascript
// Block a query shape entirely (returns error)
db.adminCommand({
  setQuerySettings: {
    find: "logs",
    filter: {},  // Unfiltered query on large collection
    $db: "mydb"
  },
  settings: {
    reject: true
  }
})

// Any query matching this shape now fails with error
db.logs.find({})  // Error: query rejected by query settings
```

**When NOT to use this pattern:**

- **Pre-MongoDB 8.0**: Query settings don't exist in earlier versions.
- **Temporary testing**: Use `hint()` for one-time testing instead.
- **Dynamic query patterns**: Query shapes must be predictable.
- **Instead of proper indexing**: Fix the index strategy first; settings are a workaround.
- **Using legacy index filters by default**: Prefer query settings (index filters are deprecated).


## Verify with

1. Run representative queries with `explain("executionStats")` before and after applying this rule.
2. Compare latency and scan efficiency (`totalDocsExamined`, `totalKeysExamined`, `nReturned`).
3. Confirm workload-level behavior using `$queryStats`, profiler, or Atlas Performance Advisor.

Reference: [Query Settings](https://mongodb.com/docs/manual/reference/command/setQuerySettings/)
