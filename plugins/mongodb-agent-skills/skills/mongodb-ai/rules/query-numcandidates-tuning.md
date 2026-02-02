---
title: numCandidates Tuning (The 20x Rule)
impact: CRITICAL
impactDescription: Too low = missed results, too high = slow queries
tags: numCandidates, tuning, recall, latency, 20x-rule
---

## numCandidates Tuning (The 20x Rule)

`numCandidates` controls how many vectors are compared during ANN search. The recommended starting point is 20x your limit.

**Incorrect (numCandidates too low):**

```javascript
// WRONG: numCandidates equal to limit
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 10,  // Same as limit - poor recall!
      limit: 10
    }
  }
])
// Result: Misses many relevant documents

// WRONG: numCandidates only slightly higher than limit
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 15,  // Only 1.5x limit - still poor recall
      limit: 10
    }
  }
])
```

**Correct (20x rule for numCandidates):**

```javascript
// CORRECT: 20x limit (recommended starting point)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,  // 20 × 10 = 200
      limit: 10
    }
  }
])

// CORRECT: Higher numCandidates for better recall
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 500,  // 50x limit - excellent recall
      limit: 10
    }
  }
])
```

**The 20x Rule:**

```
numCandidates = 20 × limit (minimum recommended)
```

| limit | numCandidates (20x) | Better Recall (50x) | Max Allowed |
|-------|---------------------|---------------------|-------------|
| 5 | 100 | 250 | 10,000 |
| 10 | 200 | 500 | 10,000 |
| 25 | 500 | 1,250 | 10,000 |
| 50 | 1,000 | 2,500 | 10,000 |
| 100 | 2,000 | 5,000 | 10,000 |

**Trade-off Visualization:**

```
numCandidates   Recall    Latency
     20x        ~90%       Low
     50x        ~95%       Medium
    100x        ~98%       Higher
    200x        ~99%       High
```

**How to Measure Recall:**

```javascript
// Compare ANN (approximate) vs ENN (exact) results
// Step 1: Get ANN results
const annResults = db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryVector,
      numCandidates: 200,  // ANN
      limit: 10
    }
  },
  { $project: { _id: 1 } }
]).toArray()

// Step 2: Get ENN results (ground truth)
const ennResults = db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryVector,
      exact: true,  // ENN - exact search
      limit: 10
    }
  },
  { $project: { _id: 1 } }
]).toArray()

// Step 3: Calculate recall
const annIds = new Set(annResults.map(d => d._id.toString()))
const matches = ennResults.filter(d => annIds.has(d._id.toString())).length
const recall = matches / ennResults.length  // Should be > 0.9
```

**When to Increase numCandidates:**

- Low recall in testing (< 90%)
- High-stakes searches where missing results is costly
- Low-dimensional vectors (< 256 dims)
- After enabling quantization

**When NOT to use this pattern:**

- Using exact search (numCandidates not used, use `exact: true`)
- numCandidates > 10,000 (MongoDB maximum)
- When latency is more important than recall

Reference: [MongoDB $vectorSearch numCandidates](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-numCandidates)
