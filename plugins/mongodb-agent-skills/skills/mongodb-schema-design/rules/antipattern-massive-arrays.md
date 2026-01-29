---
title: Limit Array Size
impact: CRITICAL
impactDescription: "Prevents O(n) operations, 10-100× write improvement for large arrays"
tags: schema, arrays, anti-pattern, performance, indexing, subset-pattern
---

## Limit Array Size

**Arrays over 1,000 elements cause severe performance issues.** Every array modification requires rewriting the entire array—adding a comment to a 5,000-element array rewrites 2.5MB. Multikey indexes on large arrays consume 1000× more memory and slow every write. This is different from unbounded arrays: even bounded arrays can be too large.

**Incorrect (large embedded arrays):**

```javascript
// Blog post with all comments embedded
// Problem: Each $push rewrites the entire 2.5MB array
{
  _id: "post123",
  title: "Popular Post",
  comments: [
    // 5,000 comments, each ~500 bytes = 2.5MB
    { author: "user1", text: "Great post!", ts: ISODate("...") },
    // ... 4,999 more
  ]
}

// Adding one comment rewrites 2.5MB on disk
// If you have an index on comments.author, that's 5,000 index entries
db.posts.updateOne(
  { _id: "post123" },
  { $push: { comments: newComment } }
)
// Write time: 200-500ms, locks document during write
```

**Correct (bounded array + overflow collection):**

```javascript
// Post with only recent comments (hard limit: 20)
{
  _id: "post123",
  title: "Popular Post",
  recentComments: [/* last 20 comments only, ~10KB */],
  commentCount: 5000
}

// All comments in separate collection
// Each comment is an independent document
{
  _id: ObjectId("..."),
  postId: "post123",
  author: "user1",
  text: "Great post!",
  ts: ISODate("2024-01-15")
}

// Add comment: atomic update with $slice keeps array bounded
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: {
      recentComments: {
        $each: [newComment],
        $slice: -20,        // Keep only last 20
        $sort: { ts: -1 }   // Most recent first
      }
    },
    $inc: { commentCount: 1 }
  }
)
// Simultaneously insert into comments collection
db.comments.insertOne({ postId: "post123", ...newComment })
// Write time: <5ms
```

**Alternative ($slice without separate collection):**

```javascript
// For simpler cases where you only ever need recent items
// Keep last 100 items, discard older automatically
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: {
      activityLog: {
        $each: [newActivity],
        $slice: -100  // Hard cap at 100 elements
      }
    }
  }
)
```

**Thresholds:**

| Array Size | Recommendation | Rationale |
|------------|----------------|-----------|
| <100 elements | Safe to embed | Negligible overhead |
| 100-500 elements | Use $slice, monitor | May need refactoring |
| 500-1000 elements | Plan migration | Performance degradation starts |
| >1000 elements | Separate collection | Unacceptable write times |

**When NOT to use this pattern:**

- **Write-once arrays**: If you build the array once and never modify, size matters less (still affects working set).
- **Arrays of primitives**: `tags: ["a", "b", "c"]` is much cheaper than array of objects.
- **Infrequent writes**: If array is updated once per day, 200ms writes may be acceptable.

**Verify with:**

```javascript
// Find documents with large arrays
db.posts.aggregate([
  { $project: {
    title: 1,
    commentsCount: { $size: { $ifNull: ["$comments", []] } }
  }},
  { $match: { commentsCount: { $gt: 100 } } },
  { $sort: { commentsCount: -1 } },
  { $limit: 10 }
])
// Red flags: any document with >1000 array elements

// Check multikey index size vs document count
db.posts.stats().indexSizes
// If "comments.author_1" is 100× larger than "_id", arrays are too big

// Profile write times for array updates
db.setProfilingLevel(1, { slowms: 100 })
// Then check db.system.profile for slow $push operations
```

Reference: [Building with Patterns - Subset Pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)
