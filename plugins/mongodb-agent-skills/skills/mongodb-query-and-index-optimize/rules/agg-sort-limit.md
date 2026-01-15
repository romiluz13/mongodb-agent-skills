---
title: Combine $sort with $limit for Top-N Queries
impact: HIGH
impactDescription: Memory-efficient top-N without sorting entire collection
tags: aggregation, sort, limit, top-n, memory, optimization
---

## Combine $sort with $limit for Top-N Queries

When getting top N results, place $limit immediately after $sort. MongoDB optimizes this pattern to maintain only N documents in memory instead of sorting the entire dataset.

**Incorrect ($sort without $limit or separated):**

```javascript
// Sorts ALL documents in memory
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } }
  // Returns 1M sorted documents
  // Uses 100MB+ memory, may spill to disk
])

// Or: $limit separated by other stages
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $addFields: { rank: "..." } },  // Breaks optimization
  { $limit: 10 }
])
```

**Correct ($limit immediately after $sort):**

```javascript
// Top 10 scores - optimized
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
  // MongoDB only tracks top 10 during sort
  // Uses ~10KB memory regardless of collection size
])

// Add fields AFTER $limit
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 },
  { $addFields: { rank: "top10" } }  // After limit is fine
])
```

**Index-backed sort (even better):**

```javascript
// Create index matching sort
db.scores.createIndex({ gameId: 1, score: -1 })

// Query uses index order - no in-memory sort needed
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $limit: 10 }
])
// IXSCAN, returns first 10 from index
```

**Multiple sort fields:**

```javascript
// Top products by rating, then by reviews
db.products.aggregate([
  { $match: { category: "electronics" } },
  { $sort: { rating: -1, reviewCount: -1 } },
  { $limit: 20 }
])

// Index for this: { category: 1, rating: -1, reviewCount: -1 }
```

**$skip with $sort + $limit (pagination):**

```javascript
// Page 3 of top scores (items 21-30)
db.scores.aggregate([
  { $match: { gameId: "game123" } },
  { $sort: { score: -1 } },
  { $skip: 20 },
  { $limit: 10 }
])
// Optimized: tracks top 30, returns 10 after skipping 20
```

**Verify optimization in explain:**

```javascript
db.scores.aggregate([...]).explain()

// Look for:
// "sortLimitCoalesced": true
// or in-memory sort size matching limit, not collection size
```

Reference: [Sort and Limit Optimization](https://mongodb.com/docs/manual/core/aggregation-pipeline-optimization/#sort-limit-coalescence)
