---
title: Use $project Early to Reduce Document Size
impact: HIGH
impactDescription: "Use $project intentionally to control shape; don't assume early placement alone improves performance"
tags: aggregation, project, memory, optimization, pipeline, addFields
---

## Use $project Early to Reduce Document Size

**Use `$project` to control output shape, but don't assume that putting it early always improves performance.** MongoDB's optimizer already prunes unused fields in many pipelines. Place `$project` where it improves correctness/readability or where you intentionally shrink payloads before expensive fan-out operations (for example inside `$lookup` sub-pipelines).

**Incorrect (carrying full documents through pipeline):**

```javascript
// Document structure: 500KB each
// {
//   _id, title, authorId, publishedAt,  // 200 bytes (what we need)
//   content: "...",                      // 100KB (HTML article body)
//   rawMarkdown: "...",                  // 80KB (source markdown)
//   revisionHistory: [...],              // 200KB (50 revisions)
//   metadata: {...},                     // 50KB (SEO, analytics)
//   comments: [...]                      // 70KB (embedded comments)
// }

db.articles.aggregate([
  { $match: { status: "published" } },
  // 10,000 published articles × 500KB = 5GB flowing through

  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    }
  },
  // Still 5GB + author data per doc

  { $unwind: "$author" },
  // 5GB in memory for $unwind

  { $sort: { publishedAt: -1 } },
  // 5GB SORT OPERATION
  // Exceeds 100MB limit → spills to disk

  { $limit: 10 },

  // Project LAST - after all the damage is done
  { $project: { title: 1, "author.name": 1, publishedAt: 1 } }
])

// Pipeline stats:
// - Memory used: 5GB+ (100MB limit exceeded)
// - Disk spills: Yes, multiple times
// - Time: 45 seconds
```

**Correct (project intentionally, and project inside `$lookup` when needed):**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // 10,000 docs enter pipeline

  // Optional projection for readability / explicit schema shaping
  {
    $project: {
      title: 1,
      authorId: 1,       // Need for $lookup
      publishedAt: 1     // Need for $sort
      // Dropped: content, rawMarkdown, revisionHistory, metadata, comments
      // 500KB → 200 bytes per doc
    }
  },
  // Result shape is explicit before downstream stages

  {
    $lookup: {
      from: "authors",
      localField: "authorId",
      foreignField: "_id",
      as: "author",
      // Project INSIDE $lookup too
      pipeline: [
        { $project: { name: 1, avatar: 1 } }  // Only needed author fields
      ]
    }
  },
  // Keep joined payload bounded with inner pipeline projection

  { $unwind: "$author" },
  // Reduced payload through unwind

  { $sort: { publishedAt: -1 } },
  // Sort operates on trimmed documents

  { $limit: 10 }
])

// Validate impact with explain() and real workload metrics
```

**Project inside $lookup (critical for joins):**

```javascript
// Without inner projection: pulls entire foreign documents
{
  $lookup: {
    from: "comments",     // Comments: 2KB average
    localField: "_id",
    foreignField: "postId",
    as: "comments"
  }
}
// 100 comments × 2KB = 200KB added per post

// With inner projection: pulls only needed fields
{
  $lookup: {
    from: "comments",
    localField: "_id",
    foreignField: "postId",
    as: "comments",
    pipeline: [
      { $match: { approved: true } },           // Filter first
      { $project: { author: 1, createdAt: 1 } }, // Then project
      { $sort: { createdAt: -1 } },
      { $limit: 5 }                              // Limit last
    ]
  }
}
// 5 comments × 50 bytes = 250 bytes added per post (800× less)
```

**$project vs $addFields vs $unset:**

```javascript
// $project: WHITELIST - explicitly specify fields to keep
// Use when: You need few fields, want to drop most
{ $project: { name: 1, email: 1 } }
// Output: { _id, name, email } - everything else gone

// $addFields: ADD or MODIFY fields, keep everything else
// Use when: Adding computed fields to existing document
{ $addFields: { fullName: { $concat: ["$first", " ", "$last"] } } }
// Output: all original fields + fullName

// $unset: BLACKLIST - remove specific fields, keep rest
// Use when: Dropping a few large fields
{ $unset: ["content", "revisionHistory", "metadata"] }
// Output: all fields except the three specified

// Performance equivalence (pick by readability):
{ $project: { content: 0, revisionHistory: 0 } }  // Exclusion mode
{ $unset: ["content", "revisionHistory"] }         // Same result
```

**Memory limit and allowDiskUse:**

```javascript
// Aggregation has 100MB per-stage memory limit
// Stages commonly affected: $sort, $group, $bucket, $setWindowFields

// When exceeded without allowDiskUse:
// Error: "Sort exceeded memory limit of 104857600 bytes"

// With allowDiskUse:
db.collection.aggregate([...], { allowDiskUse: true })
// Allows disk spill where supported

// NOTE: $facet has a hard 100MB per-stage limit and can't spill to disk.

// One option: project/shape payload before memory-heavy stages when it measurably helps
// 100MB limit ÷ document size = max docs in memory
// - 500KB docs: 200 docs before disk spill
// - 500 byte docs: 200,000 docs before disk spill
```

**Practical sizing math:**

```javascript
// Calculate memory usage for your pipeline
function estimatePipelineMemory(docCount, avgDocSizeKB, projectedSizeBytes) {
  const beforeProject = docCount * avgDocSizeKB * 1024
  const afterProject = docCount * projectedSizeBytes
  const limit = 100 * 1024 * 1024  // 100MB

  print(`Before $project: ${(beforeProject / 1024 / 1024).toFixed(1)}MB`)
  print(`After $project: ${(afterProject / 1024 / 1024).toFixed(1)}MB`)
  print(`100MB limit: ${beforeProject > limit ? "EXCEEDED ❌" : "OK ✓"}`)
  print(`With projection: ${afterProject > limit ? "Still exceeded" : "Fits in memory ✓"}`)
  print(`Memory reduction: ${((beforeProject - afterProject) / beforeProject * 100).toFixed(0)}%`)
}

// Example: 10K articles, 500KB each, projecting to 500 bytes
estimatePipelineMemory(10000, 500, 500)
// Before $project: 4882.8MB
// After $project: 4.8MB
// 100MB limit: EXCEEDED ❌
// With projection: Fits in memory ✓
// Memory reduction: 99%
```

**When NOT to rely on early `$project` as a performance fix:**

- **General case optimization**: MongoDB often already performs field-pruning automatically.
- **Document already small**: projection overhead can be negligible vs other bottlenecks.
- **Need most fields later**: If you're projecting 80% of fields, $unset the 20% instead.
- **Covered query possible**: Sometimes keeping all fields in projection allows index-only queries.
- **$facet pipelines**: Each facet starts fresh from input documents; project in each facet.
- **Dynamic field access**: If later stages use `$objectToArray` or dynamic paths, project can break them.

## Verify with

```javascript
// Check pipeline memory usage
function analyzePipelineMemory(collection, pipeline) {
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  // Find memory-intensive stages
  const stages = explain.stages || [explain]

  stages.forEach((stage, i) => {
    const stageName = Object.keys(stage).find(k => k.startsWith("$"))
    if (!stageName) return

    // Check for disk usage indicators
    const stageStr = JSON.stringify(stage)
    const usedDisk = stageStr.includes("usedDisk") && stageStr.includes("true")
    const memLimit = stageStr.includes("memoryLimitExceeded")

    if (usedDisk || memLimit) {
      print(`\n⚠️  Stage ${i} (${stageName}): Disk spill detected`)
      print("   Consider adding $project before this stage")
    }
  })

  // Show overall execution
  const stats = explain.stages?.[explain.stages.length - 1] ||
                explain.executionStats ||
                {}

  print(`\nTotal execution time: ${stats.executionTimeMillis || "N/A"}ms`)
}

// Test your pipeline
analyzePipelineMemory("articles", [
  { $match: { status: "published" } },
  { $project: { title: 1, authorId: 1, publishedAt: 1 } },
  { $sort: { publishedAt: -1 } },
  { $limit: 100 }
])
```

Reference: [Aggregation Pipeline Limits](https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
