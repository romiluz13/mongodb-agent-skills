---
title: Avoid $unwind on Large Arrays
impact: HIGH
impactDescription: Prevents document explosion and memory exhaustion
tags: aggregation, unwind, arrays, memory, anti-pattern
---

## Avoid $unwind on Large Arrays

$unwind creates one document per array element. Large arrays explode document count, consuming memory and slowing the pipeline. Filter or limit arrays before unwinding.

**Incorrect ($unwind on large arrays):**

```javascript
// Post with 10,000 comments
{
  _id: "post123",
  title: "Popular Post",
  comments: [/* 10,000 comments */]
}

// Unwind creates 10,000 documents per post
db.posts.aggregate([
  { $match: { _id: "post123" } },
  { $unwind: "$comments" },  // 1 doc → 10,000 docs
  { $group: { _id: "$comments.author", count: { $sum: 1 } } }
])
// 100 posts × 10K comments = 1M documents in memory
```

**Correct (array operations without $unwind):**

```javascript
// Use array operators instead of $unwind
db.posts.aggregate([
  { $match: { _id: "post123" } },
  {
    $project: {
      title: 1,
      commentCount: { $size: "$comments" },
      uniqueAuthors: { $setUnion: "$comments.author" },
      recentComments: { $slice: ["$comments", -5] }
    }
  }
])
// Still 1 document, no explosion
```

**Filter before $unwind:**

```javascript
// If you must $unwind, filter the array first
db.posts.aggregate([
  { $match: { _id: "post123" } },
  {
    $addFields: {
      // Filter to recent comments only
      comments: {
        $filter: {
          input: "$comments",
          cond: { $gte: ["$$this.date", lastWeek] }
        }
      }
    }
  },
  { $unwind: "$comments" },  // Now only unwinding ~100, not 10,000
  { $group: {...} }
])
```

**Limit with $slice before $unwind:**

```javascript
db.posts.aggregate([
  { $match: { featured: true } },
  {
    $addFields: {
      comments: { $slice: ["$comments", 10] }  // Max 10 per post
    }
  },
  { $unwind: "$comments" }  // Bounded: max 10 docs per post
])
```

**Alternative: Store pre-aggregated data:**

```javascript
// Instead of unwinding to count, maintain count in document
{
  _id: "post123",
  title: "Popular Post",
  commentCount: 10000,  // Pre-computed
  topCommentors: [      // Pre-computed top 5
    { author: "alice", count: 50 },
    { author: "bob", count: 45 }
  ],
  recentComments: [/* last 10 only */]
}

// No aggregation needed for common queries
db.posts.find({ featured: true }, { title: 1, commentCount: 1 })
```

**When $unwind is acceptable:**

- Small, bounded arrays (<100 elements)
- Arrays filtered/sliced before unwind
- One-time analytics (not production queries)

Reference: [$unwind](https://mongodb.com/docs/manual/reference/operator/aggregation/unwind/)
