---
title: Control $group Memory Usage
impact: HIGH
impactDescription: "Prevents aggregation failures by keeping memory usage under limits"
tags: aggregation, group, memory, allowDiskUse, pipeline-limits
---

## Control $group Memory Usage

**$group is one of the most memory-intensive stages.** If your grouping set is large or you push entire documents into arrays, you can hit the 100MB memory limit. Reduce input size early and avoid unbounded accumulators.

**Incorrect (grouping full documents into arrays):**

```javascript
// Collecting full documents explodes memory

db.orders.aggregate([
  { $group: { _id: "$customerId", orders: { $push: "$$ROOT" } } }
])
// Risk: 100MB limit exceeded
```

**Correct (project only needed fields + aggregate scalars):**

```javascript
// Keep only required fields and use scalar accumulators

db.orders.aggregate([
  { $project: { customerId: 1, total: 1 } },
  { $group: { _id: "$customerId", spend: { $sum: "$total" } } }
], { allowDiskUse: true })
```

**When NOT to use this pattern:**

- **Small datasets**: Memory limits are unlikely to be hit.
- **You actually need full documents**: Consider a $lookup after grouping.

## Verify with

```javascript
// Check if aggregation spills to disk

db.orders.explain("executionStats").aggregate([
  { $group: { _id: "$customerId", spend: { $sum: "$total" } } }
])
```

Reference: [Aggregation Pipeline Limits](https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
