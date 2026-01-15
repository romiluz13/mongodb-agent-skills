---
title: Put High-Cardinality Fields First
impact: HIGH
impactDescription: 10-100× fewer documents scanned
tags: index, cardinality, selectivity, compound-index, performance
---

## Put High-Cardinality Fields First

In compound indexes with multiple equality fields, put the most selective (highest cardinality) field first. Higher cardinality means fewer matching documents at each index level.

**Incorrect (low cardinality first):**

```javascript
// Query: Find orders by status and customerId
db.orders.find({ status: "completed", customerId: "cust123" })

// Bad index: status has only ~5 distinct values
db.orders.createIndex({ status: 1, customerId: 1 })

// Execution on 10M orders:
// status="completed" matches 3M docs → then scan for customerId
// totalKeysExamined: 3,000,000
```

**Correct (high cardinality first):**

```javascript
// Same query, better index order
db.orders.createIndex({ customerId: 1, status: 1 })

// Execution:
// customerId="cust123" matches 500 docs → then filter status
// totalKeysExamined: 500
```

**Cardinality examples:**

| Field | Cardinality | Example Values |
|-------|-------------|----------------|
| _id | Unique | 10M values in 10M docs |
| email | High | ~10M unique |
| userId | High | ~100K unique |
| country | Medium | ~200 |
| status | Low | 3-10 values |
| isActive | Very Low | 2 values (boolean) |

**Decision guide:**

```javascript
// Query: { a: value1, b: value2 }
// If a has 1000 distinct values and b has 5:
//   Index { a: 1, b: 1 } → scan ~10 docs
//   Index { b: 1, a: 1 } → scan ~2000 docs
```

**Check cardinality:**

```javascript
// Count distinct values for a field
db.orders.distinct("status").length    // 5
db.orders.distinct("customerId").length // 100000

// customerId has higher cardinality → put first
```

**Exception: When low-cardinality field is always in query:**

```javascript
// If ALL queries include status:
{ status: "pending" } // common
{ status: "pending", date: {...} } // common
{ customerId: "x" } // never happens alone

// Then status first may be acceptable for index sharing
```

Reference: [Indexing Strategies](https://mongodb.com/docs/manual/applications/indexes/)
