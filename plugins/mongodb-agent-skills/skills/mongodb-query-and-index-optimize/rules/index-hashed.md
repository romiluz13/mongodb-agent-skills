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

---

## ⚠️ Before You Implement

**I recommend a hashed index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Equality queries only | Hashed indexes cannot support range/sort | Review query patterns |
| No existing hashed index | Avoid duplicates | `db.collection.getIndexes()` |
| Shard key consideration | Hashed ensures even distribution | Review sharding strategy |

**Check for existing hashed indexes:**
```javascript
db.collection.getIndexes().filter(i =>
  Object.values(i.key).includes("hashed")
)
```

**Interpretation:**
- ✅ Equality-only + sharding: Good candidate for hashed
- ⚠️ Mixed equality/range queries: Regular index may be better
- 🔴 Range queries or sort: Do NOT use hashed

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing hashed indexes

**Just ask:** "Verify if a hashed index is appropriate for [field] on [collection]"

---

Reference: [Hashed Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-hashed/)
