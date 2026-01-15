---
title: Limit Array Size
impact: CRITICAL
impactDescription: Prevents O(n) operations and memory spikes
tags: schema, arrays, anti-pattern, performance, indexing
---

## Limit Array Size

Arrays over 1,000 elements cause severe performance issues. Every array modification requires rewriting the entire array. Multikey indexes on large arrays consume excessive memory and slow down writes.

**Incorrect (large arrays):**

```javascript
// Blog post with all comments embedded
{
  _id: "post123",
  title: "Popular Post",
  comments: [
    // 5,000 comments, each ~500 bytes
    // Total array: 2.5MB, rewritten on every new comment
  ]
}

// Adding a comment rewrites 2.5MB
db.posts.updateOne(
  { _id: "post123" },
  { $push: { comments: newComment } }
)
```

**Correct (bounded array + overflow collection):**

```javascript
// Post with only recent comments (max 20)
{
  _id: "post123",
  title: "Popular Post",
  recentComments: [/* last 20 comments */],
  commentCount: 5000
}

// All comments in separate collection
{ postId: "post123", author: "...", text: "...", ts: ISODate("...") }

// Add comment: update counter + push with $slice
db.posts.updateOne(
  { _id: "post123" },
  {
    $push: { recentComments: { $each: [newComment], $slice: -20 } },
    $inc: { commentCount: 1 }
  }
)
// Also insert into comments collection
db.comments.insertOne({ postId: "post123", ...newComment })
```

**Thresholds:**
- <100 elements: Safe to embed
- 100-1000 elements: Consider carefully, use $slice
- >1000 elements: Always separate collection

Reference: [Building with Patterns - Subset Pattern](https://mongodb.com/blog/post/building-with-patterns-the-subset-pattern)
