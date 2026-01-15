---
title: Order Compound Index Fields Correctly
impact: CRITICAL
impactDescription: 10-100× query performance improvement
tags: index, compound-index, field-order, performance, query-optimization
---

## Order Compound Index Fields Correctly

In compound indexes, put equality fields first, then sort fields, then range fields. This order maximizes index efficiency by narrowing results before sorting and filtering.

**Incorrect (range field first):**

```javascript
// Query: Find active users, sorted by name, in age range
db.users.find({
  status: "active",     // equality
  age: { $gte: 21, $lte: 65 }  // range
}).sort({ name: 1 })

// Wrong index order - range before sort
db.users.createIndex({ age: 1, name: 1, status: 1 })
// Forces in-memory sort, scans many documents
```

**Correct (equality → sort → range):**

```javascript
// Same query, optimal index
db.users.createIndex({ status: 1, name: 1, age: 1 })
//                      equality   sort     range

// Execution:
// 1. Jump to status="active" (equality narrows instantly)
// 2. Walk index in name order (no memory sort needed)
// 3. Filter by age range (at the end)
```

**Why this order works:**

```
Equality: Exact match → narrows to subset instantly
Sort:     Index order matches sort → no in-memory sort
Range:    Filters remaining results → applied last
```

**Verify with explain():**

```javascript
db.users.find({...}).sort({...}).explain("executionStats")

// Good: "stage": "IXSCAN", no SORT stage
// Bad:  "stage": "SORT" indicates in-memory sort
```

**Common mistake - putting range before sort:**

```javascript
// Query: products with price range, sorted by rating
{ price: { $lt: 100 } }  // range
.sort({ rating: -1 })    // sort

// Bad: { price: 1, rating: -1 } → forces memory sort
// Good: { rating: -1, price: 1 } → index-based sort
```

Reference: [Compound Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/)
