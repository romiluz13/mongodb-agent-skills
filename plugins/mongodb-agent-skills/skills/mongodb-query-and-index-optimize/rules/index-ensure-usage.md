---
title: Ensure Queries Use Indexes
impact: CRITICAL
impactDescription: Milliseconds vs minutes for large collections
tags: index, collscan, ixscan, explain, performance-advisor
---

## Ensure Queries Use Indexes

Every production query must use an index. Without indexes, MongoDB performs a COLLSCAN—reading every document in the collection. Always verify index usage with explain().

**Incorrect (no index, COLLSCAN):**

```javascript
// Query on field without index
db.orders.find({ customerId: "cust123" })

// explain() shows:
{
  "stage": "COLLSCAN",  // BAD: Full collection scan
  "totalDocsExamined": 10000000,
  "executionTimeMillis": 45000
}
```

**Correct (indexed query, IXSCAN):**

```javascript
// Create index first
db.orders.createIndex({ customerId: 1 })

// Same query now uses index
db.orders.find({ customerId: "cust123" })

// explain() shows:
{
  "stage": "IXSCAN",  // GOOD: Index scan
  "totalDocsExamined": 47,  // Only matching docs
  "executionTimeMillis": 2
}
```

**How to verify index usage:**

```javascript
// Check query plan
db.orders.find({ customerId: "cust123" }).explain("executionStats")

// Key metrics to check:
// 1. winningPlan.stage should be IXSCAN, not COLLSCAN
// 2. totalDocsExamined should be close to nReturned
// 3. totalKeysExamined should be close to nReturned
```

**Warning signs in explain():**

| Metric | Good | Bad |
|--------|------|-----|
| stage | IXSCAN | COLLSCAN |
| totalDocsExamined/nReturned | ~1 | >>1 |
| executionTimeMillis | <100ms | >1000ms |

**Compound index prefix rule:**

```javascript
// Index: { a: 1, b: 1, c: 1 }
db.col.find({ a: "x" })           // Uses index (prefix)
db.col.find({ a: "x", b: "y" })   // Uses index (prefix)
db.col.find({ b: "y" })           // Does NOT use index
db.col.find({ c: "z" })           // Does NOT use index
```

**Atlas Performance Advisor** automatically suggests indexes for slow queries. Enable it in Atlas to get recommendations.

Reference: [Analyze Query Performance](https://mongodb.com/docs/manual/tutorial/analyze-query-plan/)
