---
title: Use Compound Indexes for Multi-Field Queries
impact: CRITICAL
impactDescription: "10-100× faster queries by avoiding scans and in-memory sorts"
tags: index, compound-index, multifield, performance, query-optimization
---

## Use Compound Indexes for Multi-Field Queries

**Single-field indexes are not a substitute for a compound index.** If your query filters and sorts on multiple fields, create a compound index that matches the full pattern. This avoids extra filtering and in-memory sorts.

**Incorrect (separate single-field indexes):**

```javascript
// Two single-field indexes

db.orders.createIndex({ status: 1 })
db.orders.createIndex({ createdAt: -1 })

// Query filters and sorts on both fields
// MongoDB still has to filter or sort in memory

db.orders.find({ status: "shipped" }).sort({ createdAt: -1 })
```

**Correct (compound index matches the query):**

```javascript
// Compound index supports filter + sort

db.orders.createIndex({ status: 1, createdAt: -1 })

db.orders.find({ status: "shipped" }).sort({ createdAt: -1 })
// Uses IXSCAN with no in-memory sort
```

**When NOT to use this pattern:**

- **Queries only filter on one field**: A single-field index may be enough.
- **Write-heavy collections**: Extra indexes increase write cost.

**Verify with:**

```javascript
// Check for SORT stage in explain

db.orders.find({ status: "shipped" })
  .sort({ createdAt: -1 })
  .explain("executionStats")
```

---

## ⚠️ Before You Implement

**I recommend a compound index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Index doesn't exist | Avoid duplicates | `db.collection.getIndexes()` |
| Not covered by prefix | Existing compound may already cover | Review existing indexes |
| Query uses multiple fields | Single-field index may suffice | Review query patterns |

**Check existing indexes:**
```javascript
db.collection.getIndexes().forEach(i =>
  print(`${i.name}: ${JSON.stringify(i.key)}`)
)
```

**Interpretation:**
- ✅ Multi-field query + no covering compound: Create compound index
- ⚠️ Existing compound with same prefix: May not need new index
- 🔴 Exact compound already exists: Do NOT create duplicate

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing compound indexes
- `mcp__mongodb__explain` - Verify query needs compound coverage

**Just ask:** "Verify if I need a compound index for [query] on [collection]"

---

Reference: [Compound Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/)
