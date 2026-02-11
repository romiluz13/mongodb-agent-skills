---
title: Combine $sort with $limit for Top-N Queries
impact: HIGH
impactDescription: "Top 10 from 1M docs: separated stages use 100MB+; coalesced uses 10KB—10,000× less memory"
tags: aggregation, sort, limit, top-n, memory, optimization, coalescence
---

## Combine $sort with $limit for Top-N Queries

**$sort followed immediately by $limit triggers MongoDB's top-N optimization—it tracks only N documents instead of sorting everything.** Getting the top 10 scores from 1 million documents: without coalescence, MongoDB sorts all 1M docs in memory (100MB+, spills to disk). With coalescence, it maintains a 10-element heap (10KB), completing 1000× faster.

**Incorrect ($sort without $limit or with stages between):**

```javascript
// Pattern 1: $sort without $limit (sorts EVERYTHING)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } }
  // Returns ALL 1M documents, sorted
  // Memory: 100MB+ (spills to disk)
  // Time: 30+ seconds
])

// Pattern 2: Stages between $sort and $limit (breaks optimization)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  // Full sort happens here (1M docs)

  { $addFields: { rank: { $literal: "calculating..." } } },
  // This stage BREAKS coalescence!
  // MongoDB doesn't know $limit is coming

  { $limit: 10 }
  // Too late - full sort already done
])

// Pattern 3: $project between (also breaks optimization)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $project: { score: 1, player: 1 } },  // Breaks coalescence
  { $limit: 10 }
])
```

**Correct ($limit immediately after $sort):**

```javascript
// Top 10 scores - optimal pattern
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
  // COALESCED: MongoDB maintains 10-element heap
  // Memory: ~10KB (not 100MB)
  // Time: <100ms (not 30s)
])

// explain() shows:
{
  "sortLimitCoalesced": true  // ← Optimization applied!
}

// Add transformations AFTER $limit
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 },
  // Coalescence happened ✓

  // Now safe to add fields (only 10 docs)
  { $addFields: { rank: { $indexOfArray: [/* */] } } },
  { $project: { player: 1, score: 1, rank: 1 } }
])
```

**How coalescence works internally:**

```javascript
// Without coalescence (full sort):
// 1. Scan all 1M documents
// 2. Load into memory/disk
// 3. Sort all 1M by score
// 4. Return all (or slice if $limit later)
// Memory: O(n) where n = total docs

// With coalescence (heap-based):
// 1. Initialize 10-element min-heap
// 2. For each document:
//    - If score > min(heap), replace min
//    - If score <= min(heap), skip
// 3. Return heap contents sorted
// Memory: O(k) where k = limit value

// Example with scores [85, 92, 78, 95, 88, 91, 73, 99, 82, 87, 94, 76]:
// Limit 3, descending:
// Heap after each doc: [85] → [92,85] → [92,85,78] →
// [95,92,85] → [95,92,88] → [95,92,91] → [95,92,91] →
// [99,95,92] → [99,95,92] → [99,95,92] → [99,95,94] → [99,95,94]
// Result: [99, 95, 94] - never stored more than 3 docs
```

**Index-backed sort (eliminates in-memory sort entirely):**

```javascript
// Create compound index matching query + sort
db.scores.createIndex({ gameId: 1, score: -1 })

// Query reads documents in sorted order from index
db.scores.aggregate([
  { $match: { gameId: "game123" } },  // Equality on gameId
  { $sort: { score: -1 } },            // Already sorted by index!
  { $limit: 10 }
])

// explain() shows:
{
  "stage": "IXSCAN",
  "indexBounds": {
    "gameId": ["game123", "game123"],
    "score": ["[MaxKey, MinKey]"]
  },
  "direction": "forward"  // Reading index in order
}
// No in-memory sort needed - returns first 10 from index
// Memory: ~0 (just document retrieval)
// Time: <10ms
```

**$skip with $sort + $limit (pagination):**

```javascript
// Page 3: items 21-30
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $skip: 20 },
  { $limit: 10 }
])

// MongoDB optimizes this as:
// - Track top 30 documents (skip + limit)
// - Return documents 21-30
// Memory: 30-element heap (not 1M docs)

// HOWEVER: Deep pagination still degrades
// Page 10,000: skip(99990) + limit(10) = 100,000-element heap
// Solution: Use range-based pagination for deep pages
// See: query-pagination.md for cursor-based approach
```

**Multiple sort fields:**

```javascript
// Sort by rating, then review count
db.products.aggregate([
  { $match: { category: "electronics" } },
  { $sort: { rating: -1, reviewCount: -1 } },
  { $limit: 20 }
])

// Compound index for this exact sort:
db.products.createIndex({ category: 1, rating: -1, reviewCount: -1 })
// ESR: Equality (category), Sort (rating, reviewCount), Range (none)
```

**When NOT to use $sort + $limit coalescence:**

- **Need total count**: If you also need `count`, you must process all docs anyway.
- **Multiple $sorts needed**: Complex aggregations may need intermediate full sorts.
- **$facet pipelines**: Each facet runs independently; coalescence applies within each.
- **Post-sort filtering**: If you need to filter after sorting (e.g., `$match` on computed rank), full sort required.
- **Random sampling**: Use `$sample` instead for random selection (doesn't sort).

## Verify with

```javascript
// Check if coalescence is applied
function checkSortLimitCoalescence(collection, pipeline) {
  const explain = db[collection].explain("executionStats").aggregate(pipeline)

  // Look for coalescence indicator
  const explainStr = JSON.stringify(explain)
  const coalesced = explainStr.includes("sortLimitCoalesced") &&
                    explainStr.includes("true")

  // Find $sort stage
  const sortStageIndex = pipeline.findIndex(s => s.$sort)
  const limitStageIndex = pipeline.findIndex(s => s.$limit)

  print("Pipeline analysis:")
  print(`  $sort at stage: ${sortStageIndex}`)
  print(`  $limit at stage: ${limitStageIndex}`)
  print(`  Stages between: ${limitStageIndex - sortStageIndex - 1}`)
  print(`  Coalescence applied: ${coalesced ? "YES ✓" : "NO ✗"}`)

  if (!coalesced && sortStageIndex !== -1 && limitStageIndex !== -1) {
    if (limitStageIndex - sortStageIndex > 1) {
      print("\n⚠️  TIP: Move $limit immediately after $sort")
      print("   Current stages between $sort and $limit block coalescence")
    }
  }

  // Check for index-backed sort
  const indexSort = explainStr.includes("IXSCAN") &&
                    !explainStr.includes("sortStage")

  if (indexSort) {
    print("\n✓ BONUS: Sort is index-backed (no in-memory sort)")
  }

  // Show memory usage
  const execStats = explain.executionStats ||
                    explain.stages?.[explain.stages.length-1]?.executionStats

  if (execStats) {
    print(`\nExecution time: ${execStats.executionTimeMillis}ms`)
  }

  return coalesced
}

// Test your pipeline
checkSortLimitCoalescence("scores", [
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
])
```

Reference: [Sort and Limit Coalescence](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#sort-limit-coalescence)
