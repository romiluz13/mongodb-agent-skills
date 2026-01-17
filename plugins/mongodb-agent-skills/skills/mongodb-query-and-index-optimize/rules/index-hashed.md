---
title: Use Hashed Indexes for Evenly Distributed Equality Lookups
impact: HIGH
impactDescription: "Ensures uniform distribution for shard keys and fast equality lookups"
tags: index, hashed, shard-key, equality, distribution
---

## Use Hashed Indexes for Evenly Distributed Equality Lookups

**Hashed indexes are optimized for equality matches and data distribution.** Use them for shard keys or lookup-heavy fields where range queries and sorting are not required.

**Incorrect (expecting range/sort on hashed index):**

```javascript
// Hashed index cannot support range queries or sorting

db.users.createIndex({ userId: "hashed" })

db.users.find({ userId: { $gt: 1000 } }).sort({ userId: 1 })
// Range + sort cannot use the hashed index
```

**Correct (equality lookups):**

```javascript
// Hashed index for equality queries

db.users.createIndex({ userId: "hashed" })

db.users.find({ userId: 123456 })
// Uses the hashed index efficiently
```

**When NOT to use this pattern:**

- **Range queries or sorting**: Hashed indexes do not preserve order.
- **Prefix searches**: Hashed values break prefix scans.

**Verify with:**

```javascript
// Confirm equality query uses IXSCAN

db.users.find({ userId: 123456 }).explain("executionStats")
```

Reference: [Hashed Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-hashed/)
