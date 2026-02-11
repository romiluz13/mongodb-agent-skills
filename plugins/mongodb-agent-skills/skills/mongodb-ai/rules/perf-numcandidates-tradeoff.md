---
title: numCandidates Trade-offs
impact: HIGH
impactDescription: Balance recall vs latency for your use case
tags: numCandidates, recall, latency, trade-off, tuning
---

## numCandidates Trade-offs

Higher numCandidates improves recall but increases latency. Find the right balance for your use case through testing.

**Incorrect (extreme values):**

```javascript
// WRONG: Too low - poor recall
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 20,  // Too low for limit of 10
      limit: 10
    }
  }
])
// Result: ~60% recall, fast but missing relevant results

// WRONG: Too high - unnecessary latency
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 10000,  // Maximum - overkill for most cases
      limit: 10
    }
  }
])
// Result: ~99.9% recall, but 5x slower than needed
```

**Correct (tuned for use case):**

```javascript
// Real-time search: Optimize for latency
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,  // 10x limit - fast, acceptable recall
      limit: 10
    }
  }
])
// Result: ~85% recall, < 20ms latency

// Quality-focused search: Optimize for recall
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 500,  // 50x limit - high recall
      limit: 10
    }
  }
])
// Result: ~97% recall, < 50ms latency

// Critical search: Maximum recall
db.legalDocs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 2000,  // 200x limit
      limit: 10
    }
  }
])
// Result: ~99% recall, < 100ms latency
```

**Benchmark Your Specific Dataset:**

```javascript
async function benchmarkNumCandidates(queryVector, testCandidates = [50, 100, 200, 500, 1000]) {
  // Get ground truth with ENN
  const groundTruth = await db.products.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryVector,
        exact: true,
        limit: 10
      }
    },
    { $project: { _id: 1 } }
  ]).toArray()

  const groundTruthIds = new Set(groundTruth.map(d => d._id.toString()))

  for (const candidates of testCandidates) {
    const start = Date.now()
    const results = await db.products.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: candidates,
          limit: 10
        }
      },
      { $project: { _id: 1 } }
    ]).toArray()

    const latency = Date.now() - start
    const matches = results.filter(d => groundTruthIds.has(d._id.toString())).length
    const recall = matches / groundTruth.length

    print(`numCandidates: ${candidates}, Recall: ${(recall * 100).toFixed(1)}%, Latency: ${latency}ms`)
  }
}
```

**Typical Results Pattern:**

```
numCandidates | Recall | Latency | Notes
      50      |  ~75%  |   10ms  | Too low
     100      |  ~85%  |   15ms  | Minimum viable
     200      |  ~92%  |   25ms  | Good default
     500      |  ~97%  |   45ms  | High quality
    1000      |  ~99%  |   80ms  | Near-perfect
    2000      | ~99.5% |  150ms  | Diminishing returns
```

**Use Case Guidelines:**

| Use Case | Recommended | Rationale |
|----------|-------------|-----------|
| Autocomplete | 50-100 | Speed > precision |
| Product search | 200-500 | Balance |
| RAG context | 100-200 | Good enough for context |
| Legal discovery | 1000-2000 | Can't miss relevant docs |
| Duplicate detection | 500-1000 | High precision needed |

**When NOT to use this pattern:**

- Using ENN (exact: true) - numCandidates not applicable
- Very small datasets (< 1000 vectors) - minimal impact
- When latency doesn't matter - just use high value

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB $vectorSearch Performance](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)
