---
title: HNSW Index Options Tuning
impact: MEDIUM
impactDescription: Fine-tune index build and search parameters for specific workloads
tags: HNSW, maxEdges, numEdgeCandidates, graph, tuning
---

## HNSW Index Options Tuning

HNSW (Hierarchical Navigable Small World) graph parameters control index build quality and search accuracy. Tune for your workload only after baseline testing with defaults.

**Incorrect (ignoring HNSW options):**

```javascript
// Using only defaults without considering workload
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No hnswOptions - uses defaults
  }]
})
// Result: May be suboptimal for specific use cases
```

**Correct (configured HNSW options):**

```javascript
// High-recall configuration (better accuracy)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    hnswOptions: {
      maxEdges: 64,           // More connections per node
      numEdgeCandidates: 400  // More candidates during build
    }
  }]
})

// Fast-build configuration (quicker indexing)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    hnswOptions: {
      maxEdges: 16,           // Fewer connections
      numEdgeCandidates: 100  // Minimum valid value
    }
  }]
})
```

**HNSW Parameters Explained:**

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `maxEdges` | 16 | 16-64 | Connections per node in graph |
| `numEdgeCandidates` | 100 | 100-3200 | Candidates evaluated during build |

**Trade-offs:**

```
Higher maxEdges / numEdgeCandidates:
  + Better recall
  + More accurate results
  - Larger index size
  - Slower index build
  - More memory usage

Lower maxEdges / numEdgeCandidates:
  + Faster index build
  + Smaller index size
  + Less memory usage
  - Lower recall
  - May miss relevant results
```

**Recommended Configurations:**

| Use Case | maxEdges | numEdgeCandidates | Notes |
|----------|----------|-------------------|-------|
| Default | 16 | 100 | Good baseline before tuning |
| High precision | 32-64 | 400-800 | Higher recall, higher resource cost |
| Large scale | 16-32 | 100-300 | Control index cost at scale |
| Rapid prototyping | 16 | 100 | Fastest valid build profile |

**When to Adjust:**

```javascript
// Scenario 1: Low recall despite high numCandidates in queries
// Solution: Increase maxEdges for better graph connectivity
{
  hnswOptions: { maxEdges: 32, numEdgeCandidates: 400 }
}

// Scenario 2: Index build taking too long
// Solution: Reduce numEdgeCandidates
{
  hnswOptions: { maxEdges: 16, numEdgeCandidates: 150 }
}

// Scenario 3: Index too large for available RAM
// Solution: Reduce both parameters
{
  hnswOptions: { maxEdges: 16, numEdgeCandidates: 120 }
}
```

**Memory Impact:**

```
Index memory ≈ numVectors × (dimensions × 4 bytes + maxEdges × 8 bytes)

Example: 1M vectors, 1536 dims, maxEdges=32
  Vectors: 1M × 1536 × 4 = 6.14 GB
  Graph:   1M × 32 × 8   = 0.26 GB
  Total:   ~6.4 GB

With maxEdges=64:
  Graph:   1M × 64 × 8   = 0.51 GB
  Total:   ~6.65 GB
```

**Verify Configuration:**

```javascript
// Check current index configuration
db.products.getSearchIndexes().forEach(idx => {
  if (idx.latestDefinition.fields) {
    idx.latestDefinition.fields.forEach(field => {
      if (field.type === "vector") {
        print(`HNSW Options: ${JSON.stringify(field.hnswOptions || "defaults")}`)
      }
    })
  }
})
```

**When NOT to use this pattern:**

- Default settings work well for most cases
- Small datasets (< 100K vectors) - minimal impact
- Using quantization (already optimizes memory)
- Teams without reproducible benchmark data for recall/latency trade-offs

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Index Definition](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)
