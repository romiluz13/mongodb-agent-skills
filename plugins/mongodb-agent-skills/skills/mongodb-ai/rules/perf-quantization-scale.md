---
title: Enable Quantization at Scale
impact: HIGH
impactDescription: Use quantization when vector memory pressure becomes a real sizing constraint
tags: quantization, scale, RAM, performance, required-memory
---

## Enable Quantization at Scale

Enable quantization when vector memory requirements become material. MongoDB docs recommend considering quantization for larger datasets, typically `100,000+` vectors, and performance guidance also calls it out when vector memory grows beyond roughly `3 GB`. Use those as starting signals, then benchmark on your own workload.

**Incorrect (no quantization on large dataset):**

```javascript
// WRONG: large vector index with no quantization plan
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No quantization - expensive!
  }]
})
```

**Correct (quantization enabled):**

```javascript
// Use docs-backed signals first:
// - large datasets (typically 100K+ vectors)
// - Atlas Required Memory / vector memory pressure
// Then benchmark scalar vs binary on your own workload.
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "scalar"
  }]
})
```

**Docs-backed rollout guidance:**

- Use Atlas `Required Memory` and Search metrics as the primary sizing signals.
- Benchmark `scalar` and `binary` on representative queries before rollout.
- Re-run quality checks after quantization changes because memory savings and recall are a trade-off, not a free win.

**Monitoring Vector Index Size:**

```javascript
// Check index status
db.products.getSearchIndexes().forEach(idx => {
  if (idx.type === "vectorSearch") {
    print(`Index: ${idx.name}`)
    print(`Status: ${idx.status}`)
    print(`Queryable: ${idx.queryable}`)
  }
})

// Atlas UI: check "Required Memory" and Search metrics
```

**Migrating to Quantization:**

```javascript
// Update existing index to add quantization
// Note: This triggers index rebuild
db.runCommand({
  updateSearchIndex: "products",
  name: "vector_index",
  definition: {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine",
      quantization: "binary"
    }]
  }
})
```

**When NOT to use this pattern:**

- Small datasets where memory pressure is minimal
- Already using pre-quantized embeddings from model
- Testing/development environments

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Quantization](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
