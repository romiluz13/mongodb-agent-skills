---
title: Use Range-Based Pagination
impact: HIGH
impactDescription: O(1) vs O(n) performance on deep pages
tags: query, pagination, skip, cursor, performance
---

## Use Range-Based Pagination

Avoid skip() for pagination—it scans and discards documents. Use range-based pagination with indexed fields for consistent O(1) performance on any page.

**Incorrect (skip degrades on deep pages):**

```javascript
// Page 1: skip 0, fast
db.posts.find().sort({ createdAt: -1 }).skip(0).limit(20)
// Examines 20 docs

// Page 100: skip 1980, slow
db.posts.find().sort({ createdAt: -1 }).skip(1980).limit(20)
// Examines 2000 docs, discards 1980

// Page 10000: skip 199980, very slow
db.posts.find().sort({ createdAt: -1 }).skip(199980).limit(20)
// Examines 200000 docs, discards 199980
```

**Correct (range-based / cursor pagination):**

```javascript
// Page 1: Get first 20
const page1 = await db.posts.find()
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Store last item's sort value
const lastCreatedAt = page1[page1.length - 1].createdAt

// Page 2: Query from where page 1 left off
const page2 = await db.posts.find({
  createdAt: { $lt: lastCreatedAt }
})
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray()

// Always examines only 20 docs, regardless of page number
```

**Handle ties in sort field:**

```javascript
// If createdAt can have duplicates, add _id as tiebreaker
// Index: { createdAt: -1, _id: -1 }

const lastItem = page1[page1.length - 1]

const page2 = await db.posts.find({
  $or: [
    { createdAt: { $lt: lastItem.createdAt } },
    {
      createdAt: lastItem.createdAt,
      _id: { $lt: lastItem._id }
    }
  ]
})
  .sort({ createdAt: -1, _id: -1 })
  .limit(20)
  .toArray()
```

**Performance comparison (10M documents):**

| Page | skip() time | Range time |
|------|-------------|------------|
| 1 | 5ms | 5ms |
| 100 | 200ms | 5ms |
| 10000 | 20s | 5ms |

**When skip() is acceptable:**

- Small collections (<10K docs)
- Users won't paginate deeply
- Random access to any page required

**API design for cursor pagination:**

```javascript
// Response includes cursor for next page
{
  data: [...],
  nextCursor: "eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTE1IiwiX2lkIjoiYWJjMTIzIn0="
}

// Client sends cursor for next page
GET /posts?cursor=eyJjcmVhdGVkQXQiOi...
```

Reference: [Pagination Best Practices](https://mongodb.com/docs/manual/reference/method/cursor.skip/)
