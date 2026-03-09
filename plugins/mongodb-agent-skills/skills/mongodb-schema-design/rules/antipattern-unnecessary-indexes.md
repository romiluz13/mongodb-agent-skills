---
title: "Treat Index Explosion as a Schema Smell"
impact: CRITICAL
tags: [antipattern, indexes, performance, atlas-suggestion]
---

# Treat Index Explosion as a Schema Smell

Every index has a write cost. On insert, update, and delete, MongoDB must update all indexes on the collection. Too many indexes often indicate a schema or access-pattern problem, not just an operations problem.

This schema skill owns the smell detection:
- too many indexes created to compensate for unstable schema or too many optional access paths
- indexes multiplying because of polymorphic or sparse field sprawl
- indexes added reactively because related data is modeled in ways that force many query variants

For operational index auditing, hide/drop workflows, and index-usage verification, use `mongodb-query-and-index-optimize`.

## Why It Matters

- Each index adds overhead to every write operation (insert/update/delete must update all indexes)
- Indexes consume RAM in the WiredTiger cache, competing with working set data
- Atlas Performance Advisor surfacing redundant or unused indexes is often a signal to revisit schema boundaries, not just trim indexes

## Schema-Level Smells

```javascript
// Smell: a single entity accumulates many overlapping indexes
db.orders.createIndex({ status: 1 })
db.orders.createIndex({ status: 1, createdAt: -1 })
db.orders.createIndex({ status: 1, customerId: 1 })
db.orders.createIndex({ status: 1, channel: 1 })
db.orders.createIndex({ customerId: 1, createdAt: -1 })

// Ask first:
// - Is the schema forcing too many query shapes?
// - Should related data be embedded instead?
// - Should optional attributes move to an attribute pattern?
// - Is one collection serving too many unrelated access paths?
```

## Correct Pattern

```javascript
// Reduce index demand by reducing query-shape sprawl
{
  _id: 1,
  customerId: 1,
  status: "open",
  createdAt: ISODate("2026-03-08"),
  summary: {
    channel: "web",
    total: 125.00
  }
}

// Then design a smaller set of indexes around stable access paths.
```

## When NOT to use this pattern

- You already know the schema is sound and only need operational index cleanup. Use `mongodb-query-and-index-optimize`.
- The index issue is isolated to one or two clearly redundant indexes with no schema design implication.

## Verify with

1. Inspect whether repeated index requests map to repeated schema/access-pattern workarounds.
2. If the issue is operational verification or safe index removal, switch to `mongodb-query-and-index-optimize`.
3. If the issue is driven by document shape or relationship modeling, keep the work in this schema skill.

Reference: [Data Model Design](https://www.mongodb.com/docs/manual/data-modeling/)
