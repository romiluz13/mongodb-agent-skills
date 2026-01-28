---
title: Embed vs Reference Decision Framework
impact: HIGH
impactDescription: "Determines query patterns for lifetime of application—wrong choice costs 2-10× performance"
tags: schema, embedding, referencing, relationships, fundamentals
---

## Embed vs Reference Decision Framework

**This is the most important schema decision you'll make.** Choose embedding or referencing based on access patterns, not entity relationships. Getting this wrong means living with 2-10× slower queries or painful migrations later.

**Embed when:**
- Data is always accessed together (1:1 or 1:few relationships)
- Child data doesn't make sense without parent
- Updates to both happen atomically
- Child array is bounded (typically <100 elements)

**Reference when:**
- Data is accessed independently
- Many-to-many relationships exist
- Child data is large (>16KB each) or array is unbounded
- Different update frequencies

**Incorrect (reference when should embed):**

```javascript
// Separate collections for 1:1 data - always accessed together
// users: { _id, email }
// profiles: { userId, name, avatar, bio }

// Every user fetch requires two queries
const user = await db.users.findOne({ _id: userId })      // Query 1
const profile = await db.profiles.findOne({ userId })    // Query 2
// 2× latency, 2× index lookups
// No atomicity - what if profile insert fails after user insert?
// Orphaned profiles when user deleted - referential integrity issues
```

**Correct (embed 1:1 data):**

```javascript
// User with embedded profile - single document
// Always consistent, always atomic
{
  _id: "user123",
  email: "alice@example.com",
  profile: {
    name: "Alice Smith",
    avatar: "https://cdn.example.com/alice.jpg",
    bio: "Software developer"
  },
  createdAt: ISODate("2024-01-01")
}

// Single query returns everything
const user = await db.users.findOne({ _id: userId })
// Atomic updates - profile can't exist without user
db.users.updateOne(
  { _id: userId },
  { $set: { "profile.name": "Alice Johnson" } }
)
```

**Incorrect (embed when should reference):**

```javascript
// Blog post with ALL comments embedded - unbounded!
{
  _id: "post123",
  title: "Popular Post",
  comments: [
    // 50,000 comments × 500 bytes = 25MB document
    // Exceeds 16MB BSON limit - APPLICATION CRASH
    { author: "user1", text: "...", ts: ISODate("...") },
    // ... grows forever
  ]
}
```

**Correct (reference unbounded data):**

```javascript
// Post with comment summary embedded
{
  _id: "post123",
  title: "Popular Post",
  commentCount: 50000,
  recentComments: [/* last 5 only - bounded */]
}

// Comments in separate collection - no limit
{
  _id: ObjectId("..."),
  postId: "post123",
  author: "user1",
  text: "Great post!",
  ts: ISODate("2024-01-15")
}
// Index on postId for efficient lookups
```

**Decision Matrix:**

| Relationship | Read Pattern | Write Pattern | Bounded? | Decision |
|--------------|--------------|---------------|----------|----------|
| User → Profile | Always together | Together | Yes (1) | **Embed** |
| Order → Items | Always together | Together | Yes (<50) | **Embed** |
| Post → Comments | Together on load | Separate adds | No (unbounded) | **Reference** |
| Author → Books | Separately | Separate | No (could be 100+) | **Reference** |
| Product ↔ Category | Either way | Either | N/A (many-to-many) | **Reference both ways** |

**When NOT to use embedding:**

- **Data grows unbounded**: Comments, logs, events—separate collection.
- **Large child documents**: If each child is >16KB, embedding few hits 16MB limit.
- **Independent access**: If you ever query child without parent, reference.
- **Different lifecycles**: If child data is archived/deleted separately.

**Verify with:**

```javascript
// Check document sizes for embedded collections
db.posts.aggregate([
  { $project: {
    size: { $bsonSize: "$$ROOT" },
    commentCount: { $size: { $ifNull: ["$comments", []] } }
  }},
  { $match: { size: { $gt: 1000000 } } }  // >1MB
])
// Any results = refactor to reference

// Check for orphaned references
db.profiles.aggregate([
  { $lookup: {
    from: "users",
    localField: "userId",
    foreignField: "_id",
    as: "user"
  }},
  { $match: { user: { $size: 0 } } }
])
// Orphans suggest 1:1 should be embedded
```

---

## ⚠️ Before You Implement

**I recommend a schema approach, but please verify your access patterns first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Access patterns | Do you query parent+child together? | Review application queries |
| Array boundedness | Unbounded arrays must be referenced | See size query below |
| Update frequency | Different frequencies favor referencing | Review write patterns |

**Check if embedding would exceed limits:**
```javascript
db.collection.aggregate([
  { $project: {
      childCount: { $size: { $ifNull: ["$children", []] } },
      docSize: { $bsonSize: "$$ROOT" }
  }},
  { $match: { $or: [{ childCount: { $gt: 100 } }, { docSize: { $gt: 1000000 } }] } },
  { $count: "problematic" }
])
```

**Interpretation:**
- ✅ 1:1 or 1:few + bounded: Embed for atomic operations.
- ⚠️ 1:many but bounded: Embed if always accessed together.
- 🔴 Unbounded or many-to-many: Reference with separate collection.

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-schema` - Analyze current schema
- `mcp__mongodb__aggregate` - Check document/array sizes

**Just ask:** "Help me decide embed vs reference for [relationship]"

---

Reference: [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
