---
title: Use Hidden Indexes to Test Removals Safely
impact: HIGH
impactDescription: "Lets you validate index removal without affecting production traffic"
tags: index, hidden, maintenance, performance, rollback
---

## Use Hidden Indexes to Test Removals Safely

**Hidden indexes let you validate index removal without dropping them.** You can hide an index, monitor performance, and unhide it instantly if queries regress.

**Incorrect (drop index immediately):**

```javascript
// Dropping blindly can break critical queries

db.orders.dropIndex("status_1_createdAt_-1")
```

**Correct (hide, observe, then drop):**

```javascript
// Hide the index first

db.orders.hideIndex("status_1_createdAt_-1")

// If performance regresses, unhide

db.orders.unhideIndex("status_1_createdAt_-1")
```

**When NOT to use this pattern:**

- **You need to reduce storage immediately**: Hidden indexes still consume disk.
- **You are confident and have load-tested**: Dropping may be fine.

**Verify with:**

```javascript
// Check hidden flag in index definitions

db.orders.getIndexes()
```

---

## ⚠️ Before You Implement

**I recommend hiding/testing indexes, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Index exists | Can only hide existing indexes | `db.collection.getIndexes()` |
| Not _id index | Cannot hide _id | Review index name |
| $indexStats checked | Confirm index is truly unused | See query below |

**Check if index is used:**
```javascript
db.collection.aggregate([{ $indexStats: {} }])
  .filter(s => s.name === "indexName")
  .forEach(s => print(`${s.name}: ${s.accesses.ops} ops`))
// 0 ops for 30+ days = safe to hide/remove
```

**Interpretation:**
- ✅ 0 ops for 30+ days: Safe to hide and test removal
- ⚠️ Low ops: Hide and monitor before dropping
- 🔴 Active usage: Do not hide

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check index status
- `mcp__mongodb__aggregate` - Run $indexStats

**Just ask:** "Check if [index] on [collection] is safe to hide"

---

Reference: [Hidden Indexes](https://mongodb.com/docs/manual/core/index-hidden/)
