---
title: Place $match at Pipeline Start
impact: HIGH
impactDescription: 10-100× less data processed through pipeline
tags: aggregation, match, filter, optimization, index-usage
---

## Place $match at Pipeline Start

Put $match stages as early as possible in aggregation pipelines. Early filtering reduces the number of documents flowing through subsequent stages and enables index usage.

**Incorrect ($match after expensive operations):**

```javascript
db.orders.aggregate([
  // Process ALL orders first
  {
    $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },

  // Then filter - 10M lookups for 1000 results
  { $match: { status: "completed", "product.category": "electronics" } }
])
```

**Correct ($match first):**

```javascript
db.orders.aggregate([
  // Filter first - uses index on status
  { $match: { status: "completed" } },

  // Now $lookup only on filtered set
  {
    $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },

  // Additional filter after $lookup
  { $match: { "product.category": "electronics" } }
])
// 10K lookups instead of 10M
```

**MongoDB optimizes some cases automatically:**

```javascript
// MongoDB will reorder this:
db.orders.aggregate([
  { $sort: { date: -1 } },
  { $match: { status: "active" } }  // Moved before $sort
])

// But NOT this (can't move $match before $lookup):
db.orders.aggregate([
  { $lookup: {...} },
  { $match: { "joined.field": "value" } }  // Must stay after
])
```

**Split $match for optimization:**

```javascript
// When filtering on both source and looked-up fields:
db.orders.aggregate([
  // Part 1: Filter source collection (uses index)
  { $match: { status: "completed", date: { $gte: lastMonth } } },

  // $lookup
  { $lookup: { from: "customers", ... as: "customer" } },
  { $unwind: "$customer" },

  // Part 2: Filter on joined data (after $lookup)
  { $match: { "customer.tier": "premium" } }
])
```

**Verify index usage:**

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  ...
]).explain("executionStats")

// Check for IXSCAN in first stage, not COLLSCAN
```

Reference: [Aggregation Pipeline Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
