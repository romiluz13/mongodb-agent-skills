---
title: Use $project Early to Reduce Document Size
impact: HIGH
impactDescription: 2-10× less memory and faster pipeline execution
tags: aggregation, project, memory, optimization, pipeline
---

## Use $project Early to Reduce Document Size

Add $project or $addFields early to drop unnecessary fields. Large documents flowing through multiple stages waste memory and slow processing.

**Incorrect (carrying large documents through pipeline):**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // 500KB articles with full content flowing through
  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    }
  },
  { $unwind: "$author" },
  { $sort: { publishedAt: -1 } },
  { $limit: 10 },
  // Only NOW reducing fields
  { $project: { title: 1, "author.name": 1, publishedAt: 1 } }
])
// Sorted 100KB × 10000 docs in memory
```

**Correct ($project early):**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // Immediately reduce to needed fields
  {
    $project: {
      title: 1,
      authorId: 1,
      publishedAt: 1
      // Dropped: content (100KB), metadata (10KB), etc.
    }
  },
  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author",
      pipeline: [
        { $project: { name: 1 } }  // Also limit lookup result
      ]
    }
  },
  { $unwind: "$author" },
  { $sort: { publishedAt: -1 } },
  { $limit: 10 }
])
// Sorted 500 bytes × 10000 docs in memory
```

**Use $project in $lookup pipeline:**

```javascript
// Limit fields from joined collection
{
  $lookup: {
    from: "comments",
    localField: "_id",
    foreignField: "postId",
    as: "comments",
    pipeline: [
      { $match: { approved: true } },
      { $project: { text: 1, author: 1, createdAt: 1 } },
      { $limit: 5 }
    ]
  }
}
```

**When to use $addFields vs $project:**

```javascript
// $addFields: Add fields, keep everything else
{ $addFields: { fullName: { $concat: ["$first", " ", "$last"] } } }

// $project: Explicitly specify output shape
{ $project: { fullName: 1, email: 1 } }  // Only these fields

// Use $project when you want to drop most fields
// Use $addFields when adding/modifying a few fields
```

**Memory limit awareness:**

```javascript
// Aggregation has 100MB memory limit per stage
// Large documents hit this quickly

// If you must handle large docs, allow disk use:
db.collection.aggregate([...], { allowDiskUse: true })
// But better to $project early and avoid disk
```

Reference: [Aggregation Pipeline Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
