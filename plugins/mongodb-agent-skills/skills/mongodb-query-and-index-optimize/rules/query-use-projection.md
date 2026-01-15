---
title: Use Projections to Limit Fields
impact: HIGH
impactDescription: 2-10× less data transferred, better memory efficiency
tags: query, projection, bandwidth, performance, working-set
---

## Use Projections to Limit Fields

Always specify only the fields you need. Fetching entire documents wastes bandwidth, memory, and CPU when you only need a few fields.

**Incorrect (fetching entire document):**

```javascript
// Get user names - fetches everything
const users = await db.users.find({ status: "active" }).toArray()

// Each document: 50KB (profile, preferences, history, etc.)
// 1000 users = 50MB transferred
// You only use: user.name, user.email
```

**Correct (projection limits fields):**

```javascript
// Get only needed fields
const users = await db.users.find(
  { status: "active" },
  { projection: { name: 1, email: 1 } }
).toArray()

// Each document: 200 bytes
// 1000 users = 200KB transferred (250× smaller)
```

**Projection syntax:**

```javascript
// Include specific fields (1 = include)
{ name: 1, email: 1 }  // Returns _id, name, email

// Exclude _id if not needed
{ name: 1, email: 1, _id: 0 }  // Returns only name, email

// Exclude specific fields (0 = exclude)
{ largeField: 0, history: 0 }  // Returns everything except these

// Cannot mix include/exclude (except _id)
{ name: 1, largeField: 0 }  // ERROR
```

**Nested field projection:**

```javascript
// Document structure
{
  profile: {
    name: "Alice",
    bio: "...",  // large
    avatar: "...",  // large
    settings: {...}
  }
}

// Project nested fields
db.users.find(
  { _id: userId },
  { "profile.name": 1, "profile.settings": 1 }
)
```

**Array element projection:**

```javascript
// Get first N elements of array
{ items: { $slice: 5 } }  // First 5
{ items: { $slice: -3 } }  // Last 3
{ items: { $slice: [10, 5] } }  // Skip 10, take 5

// Get matching array element
{ "items.$": 1 }  // First matching element
```

**Impact example:**

```javascript
// 10M document collection, 50KB average doc size
// Query returns 10,000 documents

// Without projection: 500MB transferred, 30 seconds
// With projection (1KB): 10MB transferred, 0.5 seconds
```

Reference: [Project Fields to Return](https://mongodb.com/docs/manual/tutorial/project-fields-from-query-results/)
