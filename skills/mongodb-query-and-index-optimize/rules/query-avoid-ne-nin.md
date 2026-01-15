---
title: Avoid $ne and $nin Operators
impact: HIGH
impactDescription: 10-100× better performance using positive matching
tags: query, operators, ne, nin, anti-pattern, index-usage
---

## Avoid $ne and $nin Operators

Negation operators ($ne, $nin) cannot efficiently use indexes. They must scan all index entries except the excluded values. Use positive matching with $in or restructure the query.

**Incorrect (negation scans most of index):**

```javascript
// Find non-deleted users
db.users.find({ status: { $ne: "deleted" } })

// Even with index on status, this scans:
// - All "active" entries
// - All "pending" entries
// - All "suspended" entries
// Essentially a full index scan minus "deleted"

// Similarly bad:
db.orders.find({ status: { $nin: ["cancelled", "refunded"] } })
```

**Correct (positive matching):**

```javascript
// Explicitly list wanted values
db.users.find({ status: { $in: ["active", "pending", "suspended"] } })

// If you frequently query "not deleted", add a boolean field
db.users.find({ isActive: true })
// Index { isActive: 1 } for instant lookup

// For orders:
db.orders.find({ status: { $in: ["pending", "processing", "shipped", "delivered"] } })
```

**Schema design to avoid $ne:**

```javascript
// Instead of checking status != "deleted"
// Use a separate boolean or move deleted to archive

// Option 1: Boolean field
{
  status: "inactive",
  isDeleted: false  // Index this
}
db.users.find({ isDeleted: false, ... })

// Option 2: Move deleted to archive collection
db.users.deleteOne({ _id: userId })
db.users_archive.insertOne({ ...deletedUser, deletedAt: new Date() })
```

**Why negation is slow:**

```javascript
// Index on status: ["active", "deleted", "pending", "suspended"]
// Query: { status: { $ne: "deleted" } }
//
// MongoDB must:
// 1. Scan "active" range → return matches
// 2. Skip "deleted" range
// 3. Scan "pending" range → return matches
// 4. Scan "suspended" range → return matches
//
// Basically scans everything except "deleted"
```

**When $ne is acceptable:**

- Small collections (<10K documents)
- Query will return most documents anyway
- No better alternative exists

Reference: [Query Operators](https://mongodb.com/docs/manual/reference/operator/query/)
