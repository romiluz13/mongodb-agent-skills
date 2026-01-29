---
title: Use Unique Indexes to Enforce Constraints
impact: HIGH
impactDescription: "Prevents duplicate data and guarantees fast unique lookups"
tags: index, unique, constraints, data-integrity, upsert
---

## Use Unique Indexes to Enforce Constraints

**Unique indexes are your database-level guardrail.** They prevent duplicate values and ensure critical fields (email, SKU, external IDs) remain consistent even under concurrent writes.

**Incorrect (application-only uniqueness):**

```javascript
// Two concurrent requests insert the same email

db.users.insertOne({ email: "ada@example.com" })
db.users.insertOne({ email: "ada@example.com" })
// Duplicates now exist
```

**Correct (unique index):**

```javascript
// Enforce uniqueness at the database level

db.users.createIndex({ email: 1 }, { unique: true })

// Duplicate insert fails immediately

db.users.insertOne({ email: "ada@example.com" })
// Second insert throws duplicate key error
```

**When NOT to use this pattern:**

- **Duplicates are valid**: If the field is not a true identifier.
- **Existing duplicates**: Clean up data before creating the index.

**Verify with:**

```javascript
// Find duplicates before adding the index

db.users.aggregate([
  { $group: { _id: "$email", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

Reference: [Unique Indexes](https://mongodb.com/docs/manual/core/index-unique/)
