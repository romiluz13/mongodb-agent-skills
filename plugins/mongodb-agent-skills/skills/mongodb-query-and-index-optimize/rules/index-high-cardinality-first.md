---
title: Use Cardinality as a Tiebreaker for Equality Fields
impact: HIGH
impactDescription: "For pure equality predicates, field order is usually chosen by query shape; cardinality is a secondary tiebreaker"
tags: index, cardinality, selectivity, compound-index, performance, equality
---

## Use Cardinality as a Tiebreaker for Equality Fields

**For queries that constrain all equality fields, MongoDB can use either equality field order.** In compound indexes, exact-match fields do not need a strict internal order. Prefer ordering that best supports your broader query set (prefix reuse, sort/range requirements), then use cardinality as a tiebreaker.

**Incorrect (treating cardinality as an absolute rule):**

```javascript
// Query always constrains BOTH fields:
db.orders.find({ status: "completed", customerId: "cust123" })

// These two indexes are often equivalent for this exact predicate:
db.orders.createIndex({ status: 1, customerId: 1 })
db.orders.createIndex({ customerId: 1, status: 1 })

// Creating both only for "high-cardinality-first" usually adds write/memory cost
// without helping this query shape.
```

**Correct (choose order by workload first, cardinality second):**

```javascript
// If you also run queries on { status: ... } only:
db.orders.createIndex({ status: 1, customerId: 1 })

// If you also sort by createdAt after equality:
db.orders.createIndex({ status: 1, customerId: 1, createdAt: -1 })

// If both candidates satisfy workload shape equally, cardinality can break the tie.
```

**Practical ordering rules:**

- Put equality fields first (ESR guideline).
- Place sort fields next when sort support is required.
- Place range fields after equality/sort as needed.
- Use cardinality as a tiebreaker only when candidate index shapes are otherwise equivalent.

**When cardinality still matters:**

```javascript
// Suppose many queries only specify ONE equality field:
// - db.orders.find({ status: "completed" })
// - db.orders.find({ customerId: "cust123" })

// Then leading-field choice controls prefix usability.
// Pick the leading field that better matches your frequent standalone predicates.
```

## Verify with

```javascript
function compareIndexOrder(collection, query, indexA, indexB) {
  db[collection].createIndex(indexA, { name: "idx_a" })
  db[collection].createIndex(indexB, { name: "idx_b" })

  const a = db[collection].find(query).hint("idx_a").explain("executionStats")
  const b = db[collection].find(query).hint("idx_b").explain("executionStats")

  print("Index A:", JSON.stringify(indexA))
  print("  keysExamined:", a.executionStats.totalKeysExamined)
  print("  docsExamined:", a.executionStats.totalDocsExamined)

  print("Index B:", JSON.stringify(indexB))
  print("  keysExamined:", b.executionStats.totalKeysExamined)
  print("  docsExamined:", b.executionStats.totalDocsExamined)

  db[collection].dropIndex("idx_a")
  db[collection].dropIndex("idx_b")
}
```

Reference: [Compound Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/)
