---
title: Order Compound Index Fields Correctly (ESR Rule)
impact: CRITICAL
impactDescription: "10-100× query performance—wrong order forces full index scan + in-memory sort"
tags: index, compound-index, field-order, esr-rule, performance, query-optimization, atlas-suggestion
---

## Order Compound Index Fields Correctly (ESR Rule)

**The ESR rule (Equality → Sort → Range) is the single most important concept for compound index design.** Wrong field order forces MongoDB to scan massive portions of the index and perform expensive in-memory sorts. A 10ms query becomes a 10-second query with incorrect ordering. This is the #1 cause of index-related performance issues.

**Incorrect (range field before sort—kills performance):**

```javascript
// Query: Find active users, sorted by name, in age range
db.users.find({
  status: "active",              // Equality: exact match
  age: { $gte: 21, $lte: 65 }   // Range: bounds
}).sort({ name: 1 })             // Sort: ordering

// WRONG: Range before Sort
db.users.createIndex({ status: 1, age: 1, name: 1 })
//                      E          R        S (wrong!)

// What happens:
// 1. Jump to status="active" (good - equality works)
// 2. Scan ALL ages 21-65 in index order (bad - millions of entries)
// 3. Collect results, THEN sort in memory (terrible - 100MB+ RAM)
// Result: "SORT_KEY_GENERATOR" stage, memory limits hit, query killed
```

**Correct (Equality → Sort → Range):**

```javascript
// Same query, ESR-compliant index
db.users.createIndex({ status: 1, name: 1, age: 1 })
//                      E          S        R (correct!)

// What happens:
// 1. Jump to status="active" (equality narrows to subset)
// 2. Walk index in name order (sort is FREE - index already ordered)
// 3. For each entry, check if age in range (filter inline)
// Result: No in-memory sort, streaming results, 10ms response
```

**The ESR rule explained:**

```
┌─────────────────────────────────────────────────────────────────┐
│  E - Equality fields first                                      │
│      Exact match (=) narrows to small subset instantly          │
│      { status: "active" } → jumps directly to matching entries  │
├─────────────────────────────────────────────────────────────────┤
│  S - Sort fields second                                         │
│      Index order matches query sort → no memory sort needed     │
│      .sort({ name: 1 }) → walk index in natural order           │
├─────────────────────────────────────────────────────────────────┤
│  R - Range fields last                                          │
│      Bounds ($gt, $lt, $gte, $lte, $ne) filter remaining        │
│      { age: { $gte: 21 } } → checked inline during scan         │
└─────────────────────────────────────────────────────────────────┘
```

**Multiple equality fields—cardinality matters:**

```javascript
// Query with multiple equality conditions
db.orders.find({
  status: "shipped",      // E: ~5 distinct values
  customerId: "cust123",  // E: ~100K distinct values
  region: "US"            // E: ~50 distinct values
}).sort({ createdAt: -1 })

// Best: highest cardinality equality field first within E
db.orders.createIndex({
  customerId: 1,  // E: highest cardinality (most selective)
  region: 1,      // E: medium cardinality
  status: 1,      // E: lowest cardinality
  createdAt: -1   // S: sort field
})
// Narrows to ~50 docs at first hop instead of ~2M
```

**Real-world example—e-commerce product search:**

```javascript
// Query: In-stock electronics under $500, sorted by rating
db.products.find({
  category: "electronics",        // E: exact match
  inStock: true,                  // E: exact match (boolean)
  price: { $lte: 500 }           // R: range
}).sort({ rating: -1 }).limit(20) // S: sort

// ESR-compliant index
db.products.createIndex({
  category: 1,    // E
  inStock: 1,     // E
  rating: -1,     // S (sort before range!)
  price: 1        // R (last, even though it appears before sort in query)
})

// Execution: Jump to electronics+inStock, walk by rating desc, filter price
// Returns top 20 in <10ms even with 10M products
```

**When NOT to use strict ESR:**

- **No sort in query**: If query has no `.sort()`, you can put range anywhere after equality fields.
- **Covered queries priority**: Sometimes including projection fields matters more than perfect ESR.
- **Index reuse**: A single index serving multiple query patterns may need compromise ordering.
- **Very small result sets**: If equality already narrows to <100 docs, in-memory sort is negligible.

**Verify with explain():**

```javascript
// Check for in-memory sort (the killer)
const stats = db.users.find({
  status: "active",
  age: { $gte: 21, $lte: 65 }
}).sort({ name: 1 }).explain("executionStats")

// GOOD indicators:
// - No "SORT" stage in executionStages
// - "stage": "IXSCAN" feeds directly to "PROJECTION" or "FETCH"
// - totalDocsExamined close to nReturned

// BAD indicators (wrong field order):
// - "stage": "SORT" or "SORT_KEY_GENERATOR" appears
// - "memUsage" or "memLimit" in sort stage
// - totalKeysExamined >> nReturned

// Check winning plan stages
function hasInMemorySort(explainResult) {
  const stages = JSON.stringify(explainResult.queryPlanner.winningPlan)
  return stages.includes('"SORT"') && !stages.includes('"SORT_MERGE"')
}

if (hasInMemorySort(stats)) {
  print("WARNING: Query requires in-memory sort - check ESR order")
}
```

**Common ESR mistakes:**

```javascript
// Mistake 1: Range before Sort
// Query: { price: { $lt: 100 } }.sort({ rating: -1 })
{ price: 1, rating: -1 }  // BAD: R before S
{ rating: -1, price: 1 }  // GOOD: S before R

// Mistake 2: Treating $in as equality (it's not always)
// Query: { status: { $in: ["a", "b", "c"] } }.sort({ date: -1 })
// $in with few values acts like equality
// $in with many values acts more like range

// Mistake 3: Forgetting sort direction matters
// Query: .sort({ date: -1 })
{ date: 1 }   // Works but scans backwards (less efficient)
{ date: -1 }  // Optimal: natural index order matches query
```

---

## ⚠️ Before You Implement

**I recommend reordering index fields based on ESR, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Existing indexes | May already have an ESR-compliant index | `db.collection.getIndexes()` |
| Query patterns | Ensure this query is actually slow | `db.collection.find(...).explain("executionStats")` |
| In-memory sort | Confirm sort stage is present | Look for "SORT" in explain |

**Check for existing indexes:**
```javascript
// List all indexes and check field order
db.collection.getIndexes().forEach(idx => {
  print(`${idx.name}: ${JSON.stringify(idx.key)}`)
})
```

**Interpretation:**
- ✅ No "SORT" stage in explain: Index already correctly ordered
- ⚠️ "SORT" stage present but fast (<50ms): May not need optimization
- 🔴 "SORT" stage + slow query (>100ms): Reorder fields using ESR

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - List current indexes
- `mcp__mongodb__explain` - Analyze if query has in-memory sort

**Just ask:** "Check if my [collection] queries need ESR reordering"

---

Reference: [ESR Rule - Compound Indexes](https://mongodb.com/docs/manual/tutorial/equality-sort-range-rule/)
