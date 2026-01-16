---
title: Use allowDiskUse for Large Aggregations
impact: MEDIUM
impactDescription: "Aggregations exceeding 100MB limit: allowDiskUse prevents failure but is 10-100× slower than in-memory"
tags: aggregation, memory, allowDiskUse, sort, group, large-data
---

## Use allowDiskUse for Large Aggregations

**Aggregation pipeline stages have a 100MB memory limit per stage—allowDiskUse lets them spill to disk when exceeded.** Without it, large $sort, $group, or $bucket operations fail with "exceeded memory limit". Enable it for batch jobs and analytics, but understand it's 10-100× slower than in-memory. The real fix is optimizing your pipeline to fit in memory.

**Incorrect (large aggregation fails without allowDiskUse):**

```javascript
// Sorting 1M large documents
db.orders.aggregate([
  { $match: { year: 2024 } },      // 1M orders
  { $sort: { totalAmount: -1 } }   // Sort ALL of them
])

// ERROR: Sort exceeded memory limit of 104857600 bytes

// Why 100MB isn't enough:
// 1M docs × ~200 bytes each = 200MB for sort buffer
// Exceeds 100MB limit → operation fails

// Same problem with $group on high-cardinality field:
db.events.aggregate([
  { $group: { _id: "$sessionId", count: { $sum: 1 } } }
])
// 5M unique sessions = 5M group keys = exceeds memory
```

**Correct (allowDiskUse for large operations):**

```javascript
// Enable disk spilling for large aggregations
db.orders.aggregate(
  [
    { $match: { year: 2024 } },
    { $sort: { totalAmount: -1 } }
  ],
  { allowDiskUse: true }  // Allow disk spill
)

// Now works, but:
// - Uses temporary files on disk
// - 10-100× slower than in-memory
// - Consumes disk I/O bandwidth
// - Appropriate for batch jobs, not real-time queries
```

**When allowDiskUse is triggered:**

```javascript
// Stages that can exceed memory limit:
// - $sort (sorting large result sets)
// - $group (many unique groups)
// - $bucket / $bucketAuto (histogram creation)
// - $facet (each sub-pipeline has separate limit)
// - $setWindowFields (window computations)

// Example: $group with many unique keys
db.logs.aggregate([
  {
    $group: {
      _id: { userId: "$userId", date: "$date", action: "$action" },
      count: { $sum: 1 }
    }
  }
], { allowDiskUse: true })

// High-cardinality grouping = many group keys = memory pressure

// Example: $facet with multiple large sub-pipelines
db.products.aggregate([
  {
    $facet: {
      byCategory: [
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ],
      byPrice: [
        { $bucket: {
            groupBy: "$price",
            boundaries: [0, 100, 500, 1000, Infinity]
        }}
      ],
      topRated: [
        { $sort: { rating: -1 } },  // Each facet has 100MB limit
        { $limit: 100 }
      ]
    }
  }
], { allowDiskUse: true })
```

**Better approach: Optimize to avoid disk use:**

```javascript
// STRATEGY 1: $project early to reduce document size
// Before: 500KB docs, 100MB / 500KB = 200 docs max in memory
// After: 500 byte docs, 100MB / 500 bytes = 200,000 docs in memory

db.orders.aggregate([
  { $match: { year: 2024 } },
  // Reduce document size BEFORE memory-intensive stages
  { $project: { totalAmount: 1, customerId: 1, date: 1 } },
  { $sort: { totalAmount: -1 } }  // Now sorts smaller docs
])
// May fit in memory without allowDiskUse

// STRATEGY 2: Add $limit before $sort (top-N optimization)
db.orders.aggregate([
  { $match: { year: 2024 } },
  { $sort: { totalAmount: -1 } },
  { $limit: 100 }  // Top-N coalescence uses minimal memory
])
// Only tracks top 100, not all 1M documents

// STRATEGY 3: Use indexes for $sort
db.orders.createIndex({ year: 1, totalAmount: -1 })
db.orders.aggregate([
  { $match: { year: 2024 } },
  { $sort: { totalAmount: -1 } }
])
// Index provides sorted order, no in-memory sort needed

// STRATEGY 4: Pre-aggregate with $match
db.orders.aggregate([
  { $match: { year: 2024, status: "completed" } },  // More selective
  { $sort: { totalAmount: -1 } }
])
// Fewer documents to sort
```

**Monitor disk usage in aggregation:**

```javascript
// explain() shows if disk was used
const explain = db.orders.aggregate(
  [
    { $match: { year: 2024 } },
    { $sort: { totalAmount: -1 } }
  ],
  { allowDiskUse: true, explain: true }
)

// Look for in explain output:
// "usedDisk": true  ← Disk spill occurred
// "spills": N       ← Number of disk spills
// "spillFileSizeBytes": N  ← Size of temp files

// Or use $currentOp during execution:
db.adminCommand({ currentOp: true }).inprog.filter(op =>
  op.command?.aggregate && op.usedDisk
)
```

**allowDiskUse in drivers:**

```javascript
// Node.js
const results = await collection.aggregate(pipeline, {
  allowDiskUse: true
}).toArray()

// Python (PyMongo)
results = collection.aggregate(pipeline, allowDiskUse=True)

// Java
collection.aggregate(pipeline)
  .allowDiskUse(true)
  .into(new ArrayList<>())

// mongosh / shell
db.collection.aggregate(pipeline, { allowDiskUse: true })
```

**When NOT to use allowDiskUse:**

- **Real-time queries**: Disk I/O adds latency. Optimize pipeline instead.
- **High-concurrency scenarios**: Multiple disk spills compete for I/O.
- **Frequent queries**: If running often, fix the pipeline to fit in memory.
- **SSD concerns**: Excessive disk use can wear SSDs faster.

**When allowDiskUse IS appropriate:**

- **Batch analytics**: Nightly reports, data exports.
- **One-time data processing**: Migrations, backfills.
- **Ad-hoc queries**: Exploratory analytics by data team.
- **Large aggregations with no optimization path**: When you genuinely need all the data.

**Verify with:**

```javascript
// Check if aggregation needs allowDiskUse
function analyzeAggregationMemory(collection, pipeline) {
  // Try without allowDiskUse first
  try {
    const explain = db[collection].explain("executionStats").aggregate(pipeline)

    // Check for memory usage indicators
    const explainStr = JSON.stringify(explain)
    const usedDisk = explainStr.includes('"usedDisk":true') ||
                     explainStr.includes('"usedDisk": true')

    if (usedDisk) {
      print("⚠️  Aggregation used disk (allowDiskUse was implicitly needed)")
    } else {
      print("✓ Aggregation fits in memory")
    }

    // Find memory-intensive stages
    const stages = explain.stages || []
    stages.forEach((stage, i) => {
      const stageStr = JSON.stringify(stage)
      if (stageStr.includes("$sort") || stageStr.includes("$group")) {
        print(`\nStage ${i}: Memory-intensive operation detected`)
      }
    })

    const execTime = explain.executionStats?.executionTimeMillis
    print(`\nExecution time: ${execTime}ms`)

  } catch (err) {
    if (err.message.includes("memory limit")) {
      print("❌ Aggregation EXCEEDS memory limit")
      print("   Requires: { allowDiskUse: true }")
      print("\n   Better solutions:")
      print("   1. Add $project early to reduce document size")
      print("   2. Add $limit after $sort for top-N optimization")
      print("   3. Create index for $sort field")
      print("   4. Add more selective $match filters")
    } else {
      throw err
    }
  }
}

// Test your pipeline
analyzeAggregationMemory("orders", [
  { $match: { year: 2024 } },
  { $sort: { totalAmount: -1 } }
])
```

Reference: [Aggregation Pipeline Limits](https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
