---
title: Match Sort and Collation to Indexes
impact: HIGH
impactDescription: "Avoids in-memory sorts and ensures indexes are usable with collation"
tags: query, sort, collation, index-usage, performance
---

## Match Sort and Collation to Indexes

**Sorts are only fast when an index can provide the order.** If the index does not include the sort fields (in the right order) or the query collation differs from the index collation, MongoDB falls back to an in-memory sort.

**Incorrect (sort without matching index or collation):**

```javascript
// Index uses default collation

db.users.createIndex({ lastName: 1 })

// Query uses a different collation

db.users.find({ status: "active" })
  .collation({ locale: "en", strength: 2 })
  .sort({ lastName: 1 })
// In-memory sort because collations do not match
```

**Correct (index includes sort fields and matching collation):**

```javascript
// Create index with the same collation as the query

db.users.createIndex(
  { status: 1, lastName: 1, firstName: 1 },
  { collation: { locale: "en", strength: 2 } }
)

// Query uses matching collation and sort order

db.users.find({ status: "active" })
  .collation({ locale: "en", strength: 2 })
  .sort({ lastName: 1, firstName: 1 })
```

**When NOT to use this pattern:**

- **Small result sets**: In-memory sort cost is negligible.
- **No collation requirements**: Default collation can be simpler.

## Verify with

```javascript
// Ensure no SORT stage in executionStats

db.users.find({ status: "active" })
  .collation({ locale: "en", strength: 2 })
  .sort({ lastName: 1, firstName: 1 })
  .explain("executionStats")
```

Reference: [Sort with Indexes](https://mongodb.com/docs/manual/tutorial/sort-results-with-indexes/), [Collation](https://mongodb.com/docs/manual/reference/collation/)
