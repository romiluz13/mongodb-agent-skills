---
title: Use Projections to Limit Fields
impact: HIGH
impactDescription: "50MB→200KB data transfer, 60× less bandwidth—only fetch what you display"
tags: query, projection, bandwidth, performance, working-set, network
---

## Use Projections to Limit Fields

**Always specify only the fields you need—projections can reduce data transfer by 100× or more.** Without projections, MongoDB returns entire documents including fields you never use. We've seen API response times drop from 30 seconds to 0.5 seconds just by adding a projection that fetches 3 fields instead of 200.

**Incorrect (fetching entire documents—bandwidth killer):**

```javascript
// "Just get active users" - fetches EVERYTHING
const users = await db.users.find({ status: "active" }).toArray()

// What you actually use in your code:
users.map(u => ({ name: u.name, email: u.email }))

// What you transferred over the network:
// - name: 50 bytes
// - email: 50 bytes
// - profile: 2KB (bio, avatar URL, social links)
// - preferences: 5KB (notification settings, UI config)
// - activityHistory: 40KB (last 1000 events)
// - metadata: 3KB (audit fields, tags, scores)
// Total per doc: ~50KB

// 1,000 active users × 50KB = 50MB transferred
// You only needed: 1,000 × 100 bytes = 100KB (500× waste)
```

**Correct (projection limits to needed fields):**

```javascript
// Explicitly request only what you need
const users = await db.users.find(
  { status: "active" },
  { projection: { name: 1, email: 1, _id: 0 } }
).toArray()

// Returns:
// [
//   { name: "Alice", email: "alice@ex.com" },
//   { name: "Bob", email: "bob@ex.com" },
//   ...
// ]

// 1,000 users × 100 bytes = 100KB transferred
// Response time: 50ms instead of 30s
```

**Projection syntax reference:**

```javascript
// INCLUDE mode: specify fields to return (1 = include)
{ name: 1, email: 1 }           // Returns _id, name, email
{ name: 1, email: 1, _id: 0 }   // Returns only name, email

// EXCLUDE mode: specify fields to omit (0 = exclude)
{ largeBlob: 0, history: 0 }    // Everything except these

// CRITICAL: Cannot mix include/exclude (except _id)
{ name: 1, largeBlob: 0 }       // ERROR: Projection cannot have mix

// Nested fields use dot notation
{ "profile.name": 1, "profile.email": 1 }

// Computed fields with aggregation expressions (4.4+)
{
  fullName: { $concat: ["$firstName", " ", "$lastName"] },
  age: { $subtract: [{ $year: "$$NOW" }, { $year: "$birthDate" }] }
}
```

**Array projections (advanced):**

```javascript
// Original document
{
  _id: 1,
  title: "Article",
  comments: [/* 500 comments, 100KB */]
}

// $slice: Limit array elements
{ comments: { $slice: 5 } }      // First 5 comments
{ comments: { $slice: -3 } }     // Last 3 comments
{ comments: { $slice: [10, 5] }} // Skip 10, take 5 (pagination)

// $elemMatch: Single matching element
db.posts.find(
  { _id: postId },
  { comments: { $elemMatch: { userId: "user123" } } }
)
// Returns only the first comment by user123

// $ positional: First match from query
db.posts.find(
  { "comments.userId": "user123" },
  { "comments.$": 1 }
)
// Returns post with only the matching comment
```

**Nested document projections:**

```javascript
// Document structure
{
  profile: {
    name: "Alice",            // 50 bytes
    bio: "Long bio...",       // 10KB
    avatar: "base64...",      // 500KB
    settings: {
      theme: "dark",
      notifications: {...}
    }
  },
  analytics: {/* 50KB */}
}

// Project specific nested paths
db.users.find(
  { _id: userId },
  {
    "profile.name": 1,
    "profile.settings.theme": 1,
    _id: 0
  }
)
// Returns: { profile: { name: "Alice", settings: { theme: "dark" } } }
// ~100 bytes instead of ~560KB
```

**When NOT to use projections:**

- **Need entire document**: Detail pages, edit forms—projection adds complexity with no benefit.
- **Document already small**: <1KB documents, projection overhead may not be worth it.
- **Frequent schema changes**: Projection breaks if fields are renamed; exclusion mode is safer.
- **Covered query optimization**: You might need specific fields in index for coverage.

## Verify with

```javascript
// Compare response sizes
async function measureProjectionImpact(collection, filter, projection) {
  // Without projection
  const fullDocs = await db[collection].find(filter).limit(100).toArray()
  const fullSize = JSON.stringify(fullDocs).length

  // With projection
  const projectedDocs = await db[collection]
    .find(filter, { projection })
    .limit(100)
    .toArray()
  const projectedSize = JSON.stringify(projectedDocs).length

  const reduction = ((fullSize - projectedSize) / fullSize * 100).toFixed(1)

  print(`Without projection: ${(fullSize/1024).toFixed(1)}KB`)
  print(`With projection: ${(projectedSize/1024).toFixed(1)}KB`)
  print(`Reduction: ${reduction}%`)
  print(`Savings per 10K docs: ${((fullSize - projectedSize) * 100 / 1024 / 1024).toFixed(1)}MB`)
}

// Usage
measureProjectionImpact(
  "users",
  { status: "active" },
  { name: 1, email: 1, _id: 0 }
)
```

Reference: [Project Fields to Return](https://mongodb.com/docs/manual/tutorial/project-fields-from-query-results/)
