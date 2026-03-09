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
// Result: lower overlap with exact search on many workloads

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
// Result: Higher recall potential, but often unnecessary latency overhead
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
      numCandidates: 200,  // 20x limit - docs-first starting point
      limit: 10
    }
  }
])
// Result: useful baseline for interactive workloads

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
// Result: higher recall profile with more latency cost

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
// Result: very high candidate breadth, with correspondingly higher latency
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

**Benchmark workflow for model + `numCandidates` decisions:**

```javascript
// Compare embedding model + retrieval settings together
async function benchmarkRetrievalConfigs(queries, modelConfigs, candidateGrid = [200, 500, 1000]) {
  for (const cfg of modelConfigs) {
    print(`\nModel: ${cfg.model} | dims: ${cfg.dimensions}`)

    for (const numCandidates of candidateGrid) {
      const latencies = []
      let totalRecall = 0
      let totalEmbeddingCost = 0

      for (const q of queries) {
        const queryEmbedding = await cfg.embed(q.text) // provider call
        totalEmbeddingCost += cfg.estimateCost(q.text)

        const start = Date.now()
        const ann = await db.products.aggregate([
          {
            $vectorSearch: {
              index: cfg.indexName,
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: numCandidates,
              limit: 10
            }
          },
          { $project: { _id: 1 } }
        ]).toArray()
        latencies.push(Date.now() - start)

        const enn = await db.products.aggregate([
          {
            $vectorSearch: {
              index: cfg.indexName,
              path: "embedding",
              queryVector: queryEmbedding,
              exact: true,
              limit: 10
            }
          },
          { $project: { _id: 1 } }
        ]).toArray()

        const annIds = new Set(ann.map(d => d._id.toString()))
        const matches = enn.filter(d => annIds.has(d._id.toString())).length
        totalRecall += matches / Math.max(enn.length, 1)
      }

      latencies.sort((a, b) => a - b)
      const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
      const avgRecall = totalRecall / queries.length

      print(
        `numCandidates=${numCandidates} avgRecall=${avgRecall.toFixed(3)} ` +
        `p95=${p95}ms embedCost≈${totalEmbeddingCost.toFixed(4)}`
      )
    }
  }
}
```

Select the configuration that meets your SLA and quality target, not the one with the highest recall in isolation.

**Typical Results Pattern (dataset-dependent):**

```
numCandidates | Recall Trend | Latency Trend | Notes
 lower        | lower        | lower         | Risk of missing relevant results
 medium       | better       | medium        | Often a practical balance
 higher       | highest      | highest       | Diminishing returns likely
```

**When NOT to use this pattern:**

- Using ENN (exact: true) - numCandidates not applicable
- Very small datasets (< 1000 vectors) - minimal impact
- Blindly using the maximum without recall-vs-latency benchmarking

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB $vectorSearch Performance](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)
