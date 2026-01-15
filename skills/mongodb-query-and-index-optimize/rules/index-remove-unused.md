---
title: Remove Unused Indexes
impact: HIGH
impactDescription: Reduces storage, memory, and write latency
tags: index, unused-index, indexstats, maintenance, atlas-suggestion
---

## Remove Unused Indexes

Every index costs write performance and memory. Unused indexes waste resources without benefit. Audit indexes regularly with $indexStats and remove those not serving queries.

**Incorrect (keeping all indexes "just in case"):**

```javascript
// Collection with accumulated indexes
db.products.getIndexes()
// [
//   { name: "_id_", ... },
//   { name: "sku_1", ... },
//   { name: "category_1", ... },      // Used
//   { name: "category_1_brand_1", ... }, // Covers category_1 queries too
//   { name: "name_text", ... },       // Never used
//   { name: "price_1", ... },         // Used once in 90 days
//   { name: "createdAt_1", ... }      // Never used
// ]
// 7 indexes = 7× write overhead
```

**Correct (audit and remove unused):**

```javascript
// Check index usage statistics
db.products.aggregate([{ $indexStats: {} }])

// Output shows access patterns:
[
  { name: "_id_", accesses: { ops: 50000 } },
  { name: "sku_1", accesses: { ops: 25000 } },
  { name: "category_1", accesses: { ops: 0 } },  // Redundant
  { name: "category_1_brand_1", accesses: { ops: 15000 } },
  { name: "name_text", accesses: { ops: 0 } },   // Never used
  { name: "price_1", accesses: { ops: 3 } },     // Rarely used
  { name: "createdAt_1", accesses: { ops: 0 } }  // Never used
]

// Remove unused indexes
db.products.dropIndex("name_text")
db.products.dropIndex("createdAt_1")
db.products.dropIndex("category_1")  // Redundant with compound
```

**Index redundancy rules:**

```javascript
// Index { a: 1, b: 1 } makes { a: 1 } redundant
// Keep only the compound index

// Index { a: 1 } does NOT make { a: 1, b: 1 } redundant
// They serve different queries
```

**When to drop an index:**

1. Zero accesses in $indexStats over 30+ days
2. Redundant prefix (covered by compound index)
3. Very low usage compared to collection size
4. Atlas Performance Advisor marks it unused

**Index costs:**

- Storage: Each index adds 10-30% to data size
- Memory: Indexes compete for WiredTiger cache
- Writes: Every insert/update must update all indexes

Atlas Schema Suggestions flags this as: "Remove unnecessary indexes".

Reference: [Remove Unnecessary Indexes](https://mongodb.com/docs/manual/tutorial/remove-indexes/)
