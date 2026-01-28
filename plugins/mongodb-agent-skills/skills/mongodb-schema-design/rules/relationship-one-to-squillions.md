---
title: Model One-to-Squillions with References and Summaries
impact: HIGH
impactDescription: "Prevents unbounded arrays and keeps parent documents small and fast"
tags: schema, relationships, one-to-many, references, unbounded, scalability
---

## Model One-to-Squillions with References and Summaries

**When a parent has millions of children, store children in a separate collection.** Embed only summary fields (counts, recent items) in the parent. This avoids unbounded arrays and keeps the parent document within the 16MB limit.

**Incorrect (embed massive child arrays):**

```javascript
// User document with millions of activity entries
{
  _id: "user123",
  name: "Ada",
  activities: [
    // Unbounded array - will exceed 16MB
    { ts: ISODate("2025-01-01"), action: "login" }
  ]
}
```

**Correct (reference children + summary in parent):**

```javascript
// Parent with summary only
{
  _id: "user123",
  name: "Ada",
  activityCount: 15000000,
  recentActivities: [
    { ts: ISODate("2025-01-15"), action: "login" }
  ]
}

// Child documents in separate collection
{
  _id: ObjectId("..."),
  userId: "user123",
  ts: ISODate("2025-01-01"),
  action: "login"
}

// Index for efficient fan-out queries

db.user_activities.createIndex({ userId: 1, ts: -1 })
```

**When NOT to use this pattern:**

- **Small, bounded child sets**: Embed for simplicity and atomic reads.
- **Always-accessed-together data**: Embedding may be faster.

**Verify with:**

```javascript
// Ensure parent doc stays small

db.users.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $match: { size: { $gt: 1000000 } } }
])

// Ensure child lookups are indexed

db.user_activities.find({ userId: "user123" }).explain("executionStats")
```

---

## ⚠️ Before You Implement

**I recommend separating high-cardinality children, but please verify the scale first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Actual child count | Squillions = millions+ per parent | Count children per parent |
| Parent document size | May already be near 16MB limit | Check document sizes |
| Index on child reference | Essential for efficient fan-out queries | Verify index exists |
| Summary data accuracy | Embedded counts must stay in sync | Compare counts vs actual |

**Verification query:**
```javascript
// Check parent document sizes (approaching 16MB limit?)
db.parentCollection.aggregate([
  { $project: { sizeBytes: { $bsonSize: "$$ROOT" } } },
  { $group: {
      _id: null,
      avgSizeMB: { $avg: { $divide: ["$sizeBytes", 1048576] } },
      maxSizeMB: { $max: { $divide: ["$sizeBytes", 1048576] } }
  }}
])

// Check cardinality from child side
db.childCollection.aggregate([
  { $group: { _id: "$parent_id", count: { $sum: 1 } } },
  { $group: {
      _id: null,
      avgChildren: { $avg: "$count" },
      maxChildren: { $max: "$count" },
      totalParents: { $sum: 1 }
  }}
])

// Verify index exists for fan-out queries
db.childCollection.getIndexes()
// Must have index on { parent_id: 1, ... }
```

**Interpretation:**
- ✅ Max children >1000, index exists: Squillions pattern appropriate
- ⚠️ No index on parent_id: Add index immediately
- 🔴 Max children <100: May not need squillions pattern - consider embedding

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__aggregate` - Count children per parent (verify scale)
- `mcp__mongodb__collection-indexes` - Verify index for fan-out queries
- `mcp__mongodb__collection-storage-size` - Check parent document sizes
- `mcp__mongodb__explain` - Test query performance for child lookups

**Just ask:** "Can you check if my data truly needs the one-to-squillions pattern?"

---

Reference: [Referenced One-to-Many Relationships](https://mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/)
