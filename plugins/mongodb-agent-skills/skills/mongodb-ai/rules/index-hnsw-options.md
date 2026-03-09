---
title: HNSW Index Options Tuning
impact: MEDIUM
impactDescription: Fine-tune index build and search parameters for specific workloads
tags: HNSW, maxEdges, numEdgeCandidates, graph, tuning
---

## HNSW Index Options Tuning

HNSW (Hierarchical Navigable Small World) graph parameters control index build quality and search accuracy. Tune for your workload only after baseline testing with defaults.

`hnswOptions` is documented as a Preview capability. Treat non-default tuning as release-sensitive and re-validate on upgrades.

**Incorrect (cargo-cult tuning without evidence):**

```javascript
// WRONG: copying non-default values into production without testing
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    hnswOptions: {
      maxEdges: 64,
      numEdgeCandidates: 800
    }
  }]
})
// Result: higher build and memory cost without proof it improves this workload
```

**Correct (start from defaults; tune only after measurement):**

```javascript
// Baseline: use current defaults first
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})

// Tune only after baseline tests show a need
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    hnswOptions: {
      maxEdges: 32,
      numEdgeCandidates: 200
    }
  }]
})
```

**HNSW Parameters Explained:**

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `maxEdges` | 16 | 16-64 | Connections per node in graph |
| `numEdgeCandidates` | 100 | 100-3200 | Candidates evaluated during build |

**When to Adjust:**

- Only after baseline testing with defaults.
- When recall is still below target after query-level tuning.
- When index build time or memory cost is a validated bottleneck.

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
- The target release or deployment path does not support `hnswOptions`
- You do not have reproducible benchmark data for recall/latency/build-cost trade-offs

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Index Definition](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)
