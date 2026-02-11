---
title: Use sort Option in updateOne/replaceOne for Deterministic Updates
impact: MEDIUM
impactDescription: "Deterministically select which document to update when multiple match"
tags: updateOne, replaceOne, sort, deterministic, MongoDB-8.0
---

## Use sort Option in updateOne/replaceOne for Deterministic Updates

**MongoDB 8.0 added the `sort` option to `updateOne()` and `replaceOne()`**, allowing you to deterministically select which document to update when multiple documents match the filter. This eliminates race conditions and ensures consistent behavior.

**Incorrect (non-deterministic update):**

```javascript
// Multiple documents match - which one gets updated?
// Result depends on storage order, which is undefined
db.tasks.updateOne(
  { status: "pending", priority: "high" },
  { $set: { status: "in_progress", assignee: "worker-1" } }
)
// Problem: Different runs may update different documents
// Race condition when multiple workers process tasks
```

**Correct (deterministic update with sort):**

```javascript
// MongoDB 8.0+: sort ensures we always get the oldest task
db.tasks.updateOne(
  { status: "pending", priority: "high" },
  { $set: { status: "in_progress", assignee: "worker-1" } },
  { sort: { createdAt: 1 } }  // Always update oldest first
)
// Deterministic: always updates the earliest created matching document
```

**Common use cases:**

```javascript
// FIFO queue processing - oldest first
db.queue.updateOne(
  { status: "pending" },
  { $set: { status: "processing", startedAt: new Date() } },
  { sort: { createdAt: 1 } }
)

// Priority queue - highest priority first, then oldest
db.tasks.updateOne(
  { status: "ready" },
  { $set: { status: "running" } },
  { sort: { priority: -1, createdAt: 1 } }
)

// Update most recent record
db.sessions.updateOne(
  { userId: "user123", active: true },
  { $set: { lastSeen: new Date() } },
  { sort: { createdAt: -1 } }  // Most recent session
)
```

**replaceOne with sort:**

```javascript
// Replace the oldest matching document
db.cache.replaceOne(
  { type: "config", environment: "production" },
  {
    type: "config",
    environment: "production",
    settings: { maxConnections: 100 },
    updatedAt: new Date()
  },
  { sort: { version: 1 } }  // Replace oldest version
)
```

**Combine with upsert:**

```javascript
// Upsert with sort - sort applies only when updating, not inserting
db.inventory.updateOne(
  { productId: "SKU-123", warehouse: "east" },
  { $inc: { quantity: 10 } },
  {
    sort: { lastUpdated: 1 },  // Update oldest record
    upsert: true               // Insert if none exist
  }
)
```

**Index for efficient sorted updates:**

```javascript
// Create index that supports filter + sort
db.tasks.createIndex({ status: 1, priority: -1, createdAt: 1 })

// This updateOne uses the index efficiently
db.tasks.updateOne(
  { status: "pending" },
  { $set: { status: "running" } },
  { sort: { priority: -1, createdAt: 1 } }
)
```

**When NOT to use this pattern:**

- **Pre-MongoDB 8.0**: The sort option for updateOne/replaceOne doesn't exist.
- **Only one document matches**: Sort is unnecessary overhead.
- **findOneAndUpdate exists**: For returning the document, use findOneAndUpdate with sort.
- **Bulk updates**: updateMany doesn't have sort - use aggregation pipeline or client-side logic.


## Verify with

1. Run representative queries with `explain("executionStats")` before and after applying this rule.
2. Compare latency and scan efficiency (`totalDocsExamined`, `totalKeysExamined`, `nReturned`).
3. Confirm workload-level behavior using `$queryStats`, profiler, or Atlas Performance Advisor.

Reference: [updateOne](https://mongodb.com/docs/manual/reference/method/db.collection.updateOne/)
