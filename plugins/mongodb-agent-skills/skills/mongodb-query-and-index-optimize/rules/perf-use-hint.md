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

---

## Before You Implement

**I recommend using hint() only when the optimizer picks a suboptimal plan, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current query plan | Confirm optimizer is choosing wrong index | `db.collection.find(query).explain()` |
| Target index exists | Hint fails if index doesn't exist | `db.collection.getIndexes()` |
| Performance comparison | Hinted plan must actually be faster | Compare explain() with and without hint |

**Verification query:**
```javascript
// Compare plans with and without hint
const withoutHint = db.collection.find(query).explain("executionStats")
const withHint = db.collection.find(query).hint(indexSpec).explain("executionStats")
print(`Without hint: ${withoutHint.executionStats.executionTimeMillis}ms, docs examined: ${withoutHint.executionStats.totalDocsExamined}`)
print(`With hint: ${withHint.executionStats.executionTimeMillis}ms, docs examined: ${withHint.executionStats.totalDocsExamined}`)
```

**Interpretation:**
- Good result: Hinted plan significantly faster - Use hint for this query
- Warning result: Similar performance - Hint may not be necessary
- Bad result: Hinted plan slower - Let optimizer choose, investigate why

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__explain` without hint - See current optimizer choice
- `mcp__mongodb__collection-indexes` - Verify target index exists and structure
- `mcp__mongodb__explain` with hint - Compare hinted plan performance

**Just ask:** "Can you compare query performance with and without hint({indexSpec}) on [collection]?"

---

Reference: [hint()](https://mongodb.com/docs/manual/reference/method/cursor.hint/)
