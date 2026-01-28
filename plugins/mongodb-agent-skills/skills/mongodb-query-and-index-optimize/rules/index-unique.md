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

---

## ⚠️ Before You Implement

**I recommend creating a unique index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| No existing unique index | Avoid duplicate indexes | See query below |
| No duplicate values | Index creation will FAIL if duplicates exist | See aggregation below |
| Field exists on all docs | Unique on missing field = only one null allowed | `db.collection.count({ field: { $exists: false } })` |

**Check for existing unique indexes:**
```javascript
db.collection.getIndexes().filter(i => i.unique)
```

**Find duplicates before creating unique index:**
```javascript
db.collection.aggregate([
  { $group: { _id: "$field", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $limit: 10 }
])
```

**Interpretation:**
- ✅ No duplicates found: Safe to create unique index
- ⚠️ Unique index exists on different fields: Review if both needed
- 🔴 Duplicates found: Resolve duplicates before creating index

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing unique indexes
- `mcp__mongodb__aggregate` - Scan for duplicate values

**Just ask:** "Check if I can create a unique index on [collection].[field]"

---

Reference: [Unique Indexes](https://mongodb.com/docs/manual/core/index-unique/)
