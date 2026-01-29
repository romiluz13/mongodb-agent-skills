---
title: Use hint() to Control Query Plans When Necessary
impact: MEDIUM
impactDescription: "Forces the intended index when the optimizer picks poorly"
tags: performance, hint, query-plan, index-selection, diagnostics
---

## Use hint() to Control Query Plans When Necessary

**The optimizer usually picks the best index, but not always.** Use `hint()` to force a known-good index when explain shows a bad plan, especially for critical production queries.

**Incorrect (accepting a poor plan):**

```javascript
// Query planner picks a suboptimal index

db.orders.find({ status: "shipped", createdAt: { $gte: ISODate("2025-01-01") } })
// Uses a less selective index, causing high docsExamined
```

**Correct (force the intended index):**

```javascript
// Force the compound index that matches the query

db.orders.find({
  status: "shipped",
  createdAt: { $gte: ISODate("2025-01-01") }
}).hint({ status: 1, createdAt: 1 })
```

**When NOT to use this pattern:**

- **Unknown query patterns**: Hints can lock in a bad plan.
- **Rapidly changing indexes**: Hints break if the index is removed.

**Verify with:**

```javascript
// Compare plans with and without hint

db.orders.find({ status: "shipped" })
  .hint({ status: 1, createdAt: 1 })
  .explain("executionStats")
```

Reference: [hint()](https://mongodb.com/docs/manual/reference/method/cursor.hint/)
