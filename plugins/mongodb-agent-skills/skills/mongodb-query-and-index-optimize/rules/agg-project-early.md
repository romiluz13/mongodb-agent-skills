---
title: Use $project Early to Reduce Document Size
impact: HIGH
impactDescription: "500KB docs → 500 bytes: 1000× less memory, avoids 100MB limit and disk spills"
tags: aggregation, project, memory, optimization, pipeline, addFields
---

## Use $project Early to Reduce Document Size

**Every stage processes entire documents—drop unnecessary fields early to stay in RAM.** Aggregation pipelines have a 100MB memory limit per stage. If you're processing 10,000 articles at 500KB each (5GB), you'll spill to disk immediately. Project to the 3 fields you need (500 bytes each = 5MB) and the entire pipeline runs in memory, 100× faster.

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
  // Disk sort: 10-100× slower than in-memory

  { $limit: 10 },

  // Project LAST - after all the damage is done
  { $project: { title: 1, "author.name": 1, publishedAt: 1 } }
])

// Pipeline stats:
// - Memory used: 5GB+ (100MB limit exceeded)
// - Disk spills: Yes, multiple times
// - Time: 45 seconds
```

**Correct ($project immediately after $match):**

```javascript
db.articles.aggregate([
  { $match: { status: "published" } },
  // 10,000 docs enter pipeline

  // IMMEDIATELY reduce to needed fields
  {
    $project: {
      title: 1,
      authorId: 1,       // Need for $lookup
      publishedAt: 1     // Need for $sort
      // Dropped: content, rawMarkdown, revisionHistory, metadata, comments
      // 500KB → 200 bytes per doc
    }
  },
  // Now: 10,000 × 200 bytes = 2MB (not 5GB!)

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
  // 2MB + 100 bytes per author = still ~2MB

  { $unwind: "$author" },
  // 2MB

  { $sort: { publishedAt: -1 } },
  // 2MB sort - fits in memory easily

  { $limit: 10 }
])

// Pipeline stats:
// - Memory used: ~2MB (well under 100MB)
// - Disk spills: None
// - Time: 200ms (225× faster)
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
// Stages affected: $sort, $group, $bucket, $facet

// When exceeded without allowDiskUse:
// Error: "Sort exceeded memory limit of 104857600 bytes"

// With allowDiskUse:
db.collection.aggregate([...], { allowDiskUse: true })
// Works, but 10-100× slower due to disk I/O

// BETTER: Project early so you never hit the limit
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

**When NOT to use early $project:**

- **Document already small**: <1KB documents, projection overhead isn't worth it.
- **Need most fields later**: If you're projecting 80% of fields, $unset the 20% instead.
- **Covered query possible**: Sometimes keeping all fields in projection allows index-only queries.
- **$facet pipelines**: Each facet starts fresh from input documents; project in each facet.
- **Dynamic field access**: If later stages use `$objectToArray` or dynamic paths, project can break them.

**Verify with:**

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
