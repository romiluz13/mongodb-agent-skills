---
title: Use Clustered Collections for Ordered Storage
impact: HIGH
impactDescription: "Speeds up range queries on the clustered key and reduces storage overhead"
tags: index, clustered, collection, range-queries, storage
---

## Use Clustered Collections for Ordered Storage

**Clustered collections store documents ordered by a single clustered key.** This improves range query performance and can reduce storage because the clustered index and documents are stored together.

**Incorrect (range queries on unclustered collections):**

```javascript
// Default collection stores documents out of order
// Range queries rely entirely on secondary indexes

db.events.find({ eventId: { $gte: 1000, $lt: 2000 } })
```

**Correct (clustered collection on the range key):**

```javascript
// Create a clustered collection at creation time

db.createCollection("events", {
  clusteredIndex: { key: { eventId: 1 }, unique: true }
})

// Range queries benefit from ordered storage

db.events.find({ eventId: { $gte: 1000, $lt: 2000 } })
```

**When NOT to use this pattern:**

- **Access pattern does not use the clustered key**: No benefit.
- **Frequent updates to the clustered key**: Requires document relocation.
- **Existing collections**: Clustered indexes must be defined at creation time.

**Verify with:**

```javascript
// Inspect collection options for clusteredIndex

db.getCollectionInfos({ name: "events" })
```

---

## ⚠️ Before You Implement

**I recommend a clustered collection, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| New collection | Clustered index must be set at creation | Check if collection exists |
| Range queries on key | Only benefits ordered access | Review query patterns |
| Key rarely updated | Updates to clustered key relocate doc | Review update patterns |

**Check if collection already exists:**
```javascript
db.getCollectionNames().includes("collectionName")
// If true, cannot add clustered index to existing collection
```

**Interpretation:**
- ✅ New collection + range queries: Good candidate
- ⚠️ Existing collection: Must recreate (migrate data)
- 🔴 Clustered key frequently updated: Avoid

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__list-collections` - Check if collection exists

**Just ask:** "Verify if I can create a clustered collection [name]"

---

Reference: [Clustered Collections](https://mongodb.com/docs/manual/core/clustered-collections/)
