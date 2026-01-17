---
title: Use Atlas Performance Advisor for Index Recommendations
impact: MEDIUM
impactDescription: "Finds high-impact missing indexes from real production workloads"
tags: performance, atlas, performance-advisor, indexes, diagnostics
---

## Use Atlas Performance Advisor for Index Recommendations

**Performance Advisor analyzes real workload and surfaces missing indexes.** Use it to prioritize high-impact indexes based on production queries rather than guesswork.

**Incorrect (guessing indexes without workload data):**

```javascript
// Adding indexes without evidence
// May create unnecessary write overhead

db.orders.createIndex({ status: 1 })
```

**Correct (use advisor output to guide changes):**

```javascript
// Step 1: Review Performance Advisor suggestions in Atlas
// Step 2: Validate with explain() on the exact query pattern

db.orders.find({ status: "pending", createdAt: { $gte: ISODate("2025-01-01") } })
  .explain("executionStats")
```

**When NOT to use this pattern:**

- **Not on Atlas**: Use profiler and explain() instead.
- **Synthetic workloads only**: Advisor needs real traffic to be effective.

**Verify with:**

```javascript
// After creating suggested index, confirm plan improves

db.orders.find({ status: "pending" }).explain("executionStats")
```

Reference: [Atlas Performance Advisor](https://mongodb.com/docs/atlas/performance-advisor/)
