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

---

## Before You Implement

**I recommend using Atlas Performance Advisor for index recommendations, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Running on Atlas | Advisor is Atlas-only feature | Check deployment type |
| Sufficient traffic | Advisor needs real queries to analyze | Review Performance Advisor in Atlas UI |
| Current index count | May already have similar indexes | `db.collection.getIndexes()` |

**Verification query:**
```javascript
// Before creating suggested index, validate with explain
db.collection.find(yourQueryPattern).explain("executionStats")
// Check: docsExamined >> nReturned indicates missing index
```

**Interpretation:**
- Good result: Performance Advisor shows clear index recommendations - Review and implement
- Warning result: No suggestions despite slow queries - Check if profiler is capturing traffic
- Bad result: Not on Atlas - Use system.profile and explain() instead

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - See current indexes before adding new ones
- `mcp__mongodb__explain` - Validate suggested index improves query plan
- `mcp__mongodb__find` on system.profile - Identify slow queries manually if not on Atlas

**Just ask:** "Can you check my current indexes on [collection] and validate if a new index on [fields] would help?"

---

Reference: [Atlas Performance Advisor](https://mongodb.com/docs/atlas/performance-advisor/)
