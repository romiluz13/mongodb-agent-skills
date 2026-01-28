---
title: Model One-to-One Relationships with Embedding
impact: HIGH
impactDescription: "Single read operation vs 2 queries, atomic updates guaranteed"
tags: schema, relationships, one-to-one, embedding, fundamentals
---

## Model One-to-One Relationships with Embedding

**Embed one-to-one related data directly in the parent document.** When two pieces of data always belong together and are always accessed together, they should live in the same document. Separating 1:1 data into two collections doubles your queries and breaks atomicity.

**Incorrect (separate collections for one-to-one data):**

```javascript
// User account collection
{ _id: "user123", email: "alice@example.com", createdAt: ISODate("...") }

// User profile in separate collection - always accessed with user
{ userId: "user123", name: "Alice Smith", avatar: "https://...", bio: "Developer" }

// Every user lookup requires 2 queries
const user = db.users.findOne({ _id: "user123" })
const profile = db.profiles.findOne({ userId: "user123" })
// 2 round-trips, 2 index lookups
// What if profile insert fails? Orphaned user account
// What if user deleted? Orphaned profile
```

**Correct (embedded one-to-one document):**

```javascript
// Single document contains user + profile
{
  _id: "user123",
  email: "alice@example.com",
  createdAt: ISODate("2024-01-01"),
  profile: {
    name: "Alice Smith",
    avatar: "https://cdn.example.com/alice.jpg",
    bio: "Developer building cool things"
  }
}

// Single query returns everything
db.users.findOne({ _id: "user123" })

// Atomic update - profile can't exist without user
db.users.updateOne(
  { _id: "user123" },
  { $set: { "profile.name": "Alice Johnson" } }
)

// Delete user, profile goes with it automatically
db.users.deleteOne({ _id: "user123" })
```

**Common 1:1 relationships to embed:**

| Parent | Embedded 1:1 | Why Embed |
|--------|--------------|-----------|
| User | Profile | Always displayed together |
| Country | Capital city | Geographic data accessed together |
| Building | Address | Physical entity needs location |
| Order | Shipping address | Address at time of order (immutable) |
| Product | Dimensions/weight | Shipping calculation needs both |

**Alternative (subdocument for organization):**

```javascript
// Use subdocument to logically group related fields
// Even if they're simple, grouping improves readability
{
  _id: "user123",
  email: "alice@example.com",
  auth: {
    passwordHash: "...",
    lastLogin: ISODate("..."),
    mfaEnabled: true
  },
  profile: {
    name: "Alice Smith",
    avatar: "https://..."
  },
  settings: {
    theme: "dark",
    notifications: true
  }
}
// All 1:1 data, logically organized
```

**When NOT to use this pattern:**

- **Data accessed independently**: If profile page is separate from auth operations, consider separation.
- **Different security requirements**: If auth data needs stricter access controls than profile.
- **Extreme size difference**: If embedded doc is >10KB and parent is <1KB, consider separation.
- **Different update frequencies**: If profile changes hourly but auth rarely, separate may reduce write amplification.

**Verify with:**

```javascript
// Find collections that look like 1:1 splits
db.profiles.aggregate([
  { $lookup: {
    from: "users",
    localField: "userId",
    foreignField: "_id",
    as: "user"
  }},
  { $match: { user: { $size: 1 } } },  // Exactly 1 match = 1:1
  { $count: "oneToOneRelationships" }
])
// High count suggests profiles should be embedded in users

// Check for orphaned 1:1 documents
db.profiles.aggregate([
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u" } },
  { $match: { u: { $size: 0 } } },
  { $count: "orphanedProfiles" }
])
// Any orphans = referential integrity problem, embedding solves this
```

---

## ⚠️ Before You Implement

**I recommend embedding for one-to-one, but please verify your data structure first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Truly 1:1 relationship | Must be exactly one child per parent | Check for multiple matches |
| Always accessed together | Embedding adds value only if co-accessed | Review query patterns |
| Size difference | Very large embedded docs may warrant separation | Compare document sizes |
| Security requirements | Different access controls may require separation | Review permission model |

**Verification query:**
```javascript
// Verify 1:1 relationship (no parent has multiple children)
db.childCollection.aggregate([
  { $group: { _id: "$parent_id", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $count: "parentsWithMultipleChildren" }
])
// Should return 0 for true 1:1

// Check for orphaned 1:1 documents
db.childCollection.aggregate([
  { $lookup: {
      from: "parentCollection",
      localField: "parent_id",
      foreignField: "_id",
      as: "parent"
  }},
  { $match: { parent: { $size: 0 } } },
  { $count: "orphanedChildren" }
])

// Compare document sizes
db.childCollection.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: { _id: null, avgSizeKB: { $avg: { $divide: ["$size", 1024] } } } }
])
```

**Interpretation:**
- ✅ Zero multi-matches, zero orphans: True 1:1, safe to embed
- ⚠️ Orphans exist: Clean up orphans before embedding migration
- 🔴 Multi-matches found: Not a true 1:1 - reconsider relationship type

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__aggregate` - Verify 1:1 cardinality (no duplicates)
- `mcp__mongodb__count` - Count orphaned documents
- `mcp__mongodb__collection-schema` - Compare parent and child schemas
- `mcp__mongodb__find` - Sample documents to verify relationship

**Just ask:** "Can you verify this is a true 1:1 relationship before I embed?"

---

Reference: [Model One-to-One Relationships with Embedded Documents](https://mongodb.com/docs/manual/tutorial/model-embedded-one-to-one-relationships-between-documents/)
