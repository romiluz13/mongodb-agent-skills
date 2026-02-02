---
title: HNSW Index Options Tuning
impact: MEDIUM
impactDescription: Fine-tune index build and search parameters for specific workloads
tags: HNSW, maxEdges, numEdgeCandidates, graph, tuning
---

## HNSW Index Options Tuning

HNSW (Hierarchical Navigable Small World) graph parameters control index build quality and search accuracy. Tune for your specific workload.

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
      numEdgeCandidates: 200  // More candidates during build
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
      numEdgeCandidates: 50   // Fewer candidates
    }
  }]
})
```

**HNSW Parameters Explained:**

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `maxEdges` | 32 | 4-100 | Connections per node in graph |
| `numEdgeCandidates` | 100 | 4-1000 | Candidates evaluated during build |

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
| Default | 32 | 100 | Good balance |
| High precision | 64 | 200 | Legal, medical, critical search |
| Large scale | 16-32 | 50-100 | Millions of vectors |
| Rapid prototyping | 16 | 50 | Fastest build time |

**When to Adjust:**

```javascript
// Scenario 1: Low recall despite high numCandidates in queries
// Solution: Increase maxEdges for better graph connectivity
{
  hnswOptions: { maxEdges: 48, numEdgeCandidates: 150 }
}

// Scenario 2: Index build taking too long
// Solution: Reduce numEdgeCandidates
{
  hnswOptions: { maxEdges: 32, numEdgeCandidates: 64 }
}

// Scenario 3: Index too large for available RAM
// Solution: Reduce both parameters
{
  hnswOptions: { maxEdges: 24, numEdgeCandidates: 80 }
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

Reference: [MongoDB Vector Index Definition](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)
