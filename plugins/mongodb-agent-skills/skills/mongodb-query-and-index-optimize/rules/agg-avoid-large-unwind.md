---
title: Avoid $unwind on Large Arrays
impact: HIGH
impactDescription: "100 posts × 10K comments each = 1M docs in memory; array operators keep it at 100 docs"
tags: aggregation, unwind, arrays, memory, anti-pattern, document-explosion
---

## Avoid $unwind on Large Arrays

**$unwind creates one document per array element—10,000-element arrays become 10,000 documents.** If you have 100 posts with 10,000 comments each and $unwind the comments, you've just created 1 million documents in your pipeline from 100 inputs. This explodes memory usage, exceeds the 100MB stage limit, and forces disk spills. Use array operators ($size, $filter, $slice, $reduce) to process arrays without unwinding.

**Incorrect ($unwind on large arrays—document explosion):**

```javascript
// Document: Popular post with 10,000 comments
{
  _id: "post123",
  title: "Viral Post",
  content: "...",
  comments: [
    { author: "user1", text: "Great!", date: ISODate("...") },
    { author: "user2", text: "Thanks!", date: ISODate("...") },
    // ... 9,998 more comments
  ]
}

// "Count comments per author across posts"
db.posts.aggregate([
  { $match: { featured: true } },
  // Returns: 100 featured posts

  { $unwind: "$comments" },
  // EXPLOSION: 100 posts × 10K comments = 1,000,000 documents!
  // Each doc: post data + 1 comment
  // Memory: 1M × 1KB = 1GB (exceeds 100MB limit)
  // Result: Disk spill, 10+ minute execution

  { $group: {
      _id: "$comments.author",
      commentCount: { $sum: 1 }
  }}
])

// Even worse: nested $unwind
db.posts.aggregate([
  { $unwind: "$comments" },      // 100 → 1M docs
  { $unwind: "$comments.replies" } // 1M → 100M docs!
  // Memory: Explosion beyond any reasonable limit
])
```

**Correct (array operators—no document explosion):**

```javascript
// Option 1: Use array operators instead of $unwind
db.posts.aggregate([
  { $match: { featured: true } },
  // Returns: 100 posts (stays 100 throughout)

  {
    $project: {
      title: 1,
      // Count without unwinding
      commentCount: { $size: "$comments" },

      // Get unique authors without unwinding
      uniqueAuthors: {
        $reduce: {
          input: "$comments.author",
          initialValue: [],
          in: { $setUnion: ["$$value", ["$$this"]] }
        }
      },

      // Get recent comments without unwinding
      recentComments: { $slice: ["$comments", -5] },

      // Filter specific comments without unwinding
      approvedComments: {
        $filter: {
          input: "$comments",
          cond: { $eq: ["$$this.approved", true] }
        }
      }
    }
  }
])
// Memory: 100 docs × 10KB = 1MB (not 1GB)
```

**When you must $unwind, filter first:**

```javascript
// Must $unwind to group by comment author
// Solution: Filter array BEFORE unwinding

db.posts.aggregate([
  { $match: { featured: true } },
  // 100 posts

  // Step 1: Filter array to reduce size before $unwind
  {
    $addFields: {
      comments: {
        $filter: {
          input: "$comments",
          cond: {
            $and: [
              { $eq: ["$$this.approved", true] },
              { $gte: ["$$this.date", lastWeek] }
            ]
          }
        }
      }
    }
  },
  // 10,000 comments → ~100 recent approved comments per post

  // Step 2: Now $unwind is safe
  { $unwind: "$comments" },
  // 100 posts × 100 comments = 10,000 docs (not 1M)

  { $group: {
      _id: "$comments.author",
      count: { $sum: 1 }
  }}
])
// Memory: 10K docs × 1KB = 10MB (fits easily)
```

**Use $slice to bound array before $unwind:**

```javascript
// Limit array to top N elements before unwinding
db.posts.aggregate([
  { $match: { featured: true } },

  // Bound array size
  {
    $addFields: {
      comments: { $slice: ["$comments", 100] }  // Max 100 per post
    }
  },

  // Safe to unwind: 100 posts × 100 comments = 10K docs max
  { $unwind: "$comments" },

  { $group: { _id: "$comments.author", count: { $sum: 1 } } }
])
```

**Alternative: Pre-aggregate in schema:**

```javascript
// Instead of storing and unwinding 10K comments...

// Original (problematic for aggregation):
{
  _id: "post123",
  title: "Viral Post",
  comments: [/* 10,000 comments */]  // Huge, can't efficiently aggregate
}

// Redesigned (aggregation-friendly):
{
  _id: "post123",
  title: "Viral Post",

  // Pre-computed stats (updated on each comment add)
  stats: {
    commentCount: 10000,
    uniqueAuthors: 4523,
    lastCommentAt: ISODate("2024-01-15")
  },

  // Top authors (maintained by background job)
  topCommenters: [
    { author: "user1", count: 47 },
    { author: "user2", count: 38 }
  ],

  // Only recent comments embedded
  recentComments: [/* last 10 */]
}

// Comments in separate collection
{
  _id: "comment_abc",
  postId: "post123",
  author: "user1",
  text: "Great!",
  date: ISODate("...")
}

// Now aggregation is simple:
db.posts.find({ featured: true }, { stats: 1, topCommenters: 1 })
// No aggregation needed for common queries
```

**$unwind memory math:**

```javascript
// Calculate document explosion
function calculateUnwindExplosion(collection, arrayField, filter = {}) {
  const sample = db[collection].aggregate([
    { $match: filter },
    { $sample: { size: 100 } },
    {
      $group: {
        _id: null,
        avgArraySize: { $avg: { $size: `$${arrayField}` } },
        maxArraySize: { $max: { $size: `$${arrayField}` } },
        docCount: { $sum: 1 }
      }
    }
  ]).toArray()[0]

  const totalDocs = db[collection].countDocuments(filter)
  const estimatedExplosion = totalDocs * sample.avgArraySize

  print(`$unwind analysis for ${collection}.${arrayField}:`)
  print(`  Documents matching filter: ${totalDocs.toLocaleString()}`)
  print(`  Average array size: ${Math.round(sample.avgArraySize)}`)
  print(`  Max array size: ${sample.maxArraySize}`)
  print(`  Estimated docs after $unwind: ${estimatedExplosion.toLocaleString()}`)
  print(`  Explosion factor: ${Math.round(sample.avgArraySize)}×`)

  const memoryEstimateMB = (estimatedExplosion * 1024) / (1024 * 1024)
  print(`  Estimated memory: ${memoryEstimateMB.toFixed(0)}MB`)
  print(`  100MB limit: ${memoryEstimateMB > 100 ? "EXCEEDED ⚠️" : "OK ✓"}`)

  if (memoryEstimateMB > 100) {
    print(`\n  Recommendation: Filter array before $unwind or use array operators`)
  }
}

// Check before using $unwind
calculateUnwindExplosion("posts", "comments", { featured: true })
```

**When $unwind IS acceptable:**

- **Small, bounded arrays**: <100 elements, known maximum (e.g., product categories).
- **Filtered arrays**: After $filter or $slice reduces to small set.
- **One-time analytics**: Batch reporting where you can allow disk use.
- **$lookup results**: When $lookup returns small result sets.
- **Pivot operations**: When you truly need to transform array→documents for $group.

**When NOT to use $unwind:**

- **Unbounded arrays**: User content (comments, events, logs) with no upper limit.
- **Large arrays**: >100 elements average, even if bounded.
- **Counting/aggregating arrays**: Use $size, $reduce instead.
- **Extracting array subset**: Use $slice, $filter, $arrayElemAt.
- **Production real-time queries**: Unpredictable memory usage = unpredictable latency.

## Verify with

```javascript
// Test if $unwind will cause problems
function testUnwindImpact(collection, pipeline) {
  // Find the $unwind stage
  const unwindStage = pipeline.find(s => s.$unwind)
  if (!unwindStage) {
    print("No $unwind stage found")
    return
  }

  const arrayField = typeof unwindStage.$unwind === "string"
    ? unwindStage.$unwind.replace("$", "")
    : unwindStage.$unwind.path.replace("$", "")

  // Run explain
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  // Check for disk usage
  const explainStr = JSON.stringify(explain)
  const usedDisk = explainStr.includes('"usedDisk":true') ||
                   explainStr.includes('"usedDisk": true')

  print(`$unwind on "${arrayField}":`)
  print(`  Spilled to disk: ${usedDisk ? "YES ⚠️" : "NO ✓"}`)

  if (usedDisk) {
    print(`\n  Consider:`)
    print(`  1. Add $filter before $unwind to reduce array size`)
    print(`  2. Add $slice before $unwind to cap array size`)
    print(`  3. Use array operators ($size, $reduce) instead`)
  }
}

// Test your pipeline
testUnwindImpact("posts", [
  { $match: { featured: true } },
  { $unwind: "$comments" },
  { $group: { _id: "$comments.author", count: { $sum: 1 } } }
])
```

Reference: [$unwind](https://mongodb.com/docs/manual/reference/operator/aggregation/unwind/)
