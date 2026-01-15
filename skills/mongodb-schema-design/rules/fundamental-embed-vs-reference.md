---
title: Embed vs Reference Decision Framework
impact: HIGH
impactDescription: Determines query patterns for lifetime of application
tags: schema, embedding, referencing, relationships, fundamentals
---

## Embed vs Reference Decision Framework

Choose embedding or referencing based on access patterns, not entity relationships. This decision affects every query your application makes.

**Embed when:**
- Data is always accessed together (1:1 or 1:few)
- Child data doesn't make sense without parent
- Updates to both happen atomically
- Child array is bounded (<100 elements typical)

**Reference when:**
- Data is accessed independently
- Many-to-many relationships
- Child data is large (>16KB) or unbounded
- Different update frequencies

**Incorrect (reference when should embed):**

```javascript
// Separate user and profile - always accessed together
// users: { _id, email }
// profiles: { userId, name, avatar, bio }

// Every user fetch requires two queries
const user = await db.users.findOne({ _id: userId })
const profile = await db.profiles.findOne({ userId })
```

**Correct (embed 1:1 data):**

```javascript
// User with embedded profile
{
  _id: "user123",
  email: "alice@example.com",
  profile: {
    name: "Alice Smith",
    avatar: "https://...",
    bio: "Developer"
  }
}

// Single query returns everything
const user = await db.users.findOne({ _id: userId })
```

**Decision Matrix:**

| Relationship | Read Pattern | Write Pattern | Decision |
|--------------|--------------|---------------|----------|
| 1:1 | Always together | Together | Embed |
| 1:few | Usually together | Together | Embed |
| 1:many | Usually together | Separate | Embed (bounded) |
| 1:many | Separately | Separate | Reference |
| many:many | Any | Any | Reference |

Reference: [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
