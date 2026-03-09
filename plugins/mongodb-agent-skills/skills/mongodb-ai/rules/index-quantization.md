---
title: Vector Quantization for Scale
impact: CRITICAL
impactDescription: Reduces vector memory usage and can improve vector-search efficiency at scale
tags: quantization, scalar, binary, int8, int1, RAM, performance
---

## Vector Quantization for Scale

Quantization compresses vectors to reduce memory usage. MongoDB docs recommend considering quantization for larger datasets, typically `100,000+` vectors, and MongoDB performance guidance also calls it out when vector memory requirements are large (for example, indexes over roughly `3 GB`). Benchmark before locking in the choice.

**Incorrect (no quantization on large dataset):**

```javascript
// WRONG: large vector index with no quantization or measurement plan
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // Missing quantization!
  }]
})
```

**Correct (quantization enabled):**

```javascript
// CORRECT: Scalar quantization
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "scalar"
  }]
})

// CORRECT: Binary quantization
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "binary"
  }]
})
```

**Quantization Comparison:**

| Type | Memory Effect | Notes |
|------|---------------|-------|
| `none` | baseline | highest-fidelity baseline |
| `scalar` | about `75%` less memory than full precision | docs position this as the general-purpose quantized option |
| `binary` | about `97%` less memory than full precision | use with oversampling/rescoring; best results depend on embedding/model behavior |

MongoDB docs explicitly recommend using `dotProduct` similarity with normalized vectors to get the best results from vector quantization.

**How to Verify RAM Usage:**

```javascript
// Atlas UI:
// Collections > Search Indexes > Required Memory
//
// Re-run representative ANN/ENN comparisons after changing quantization.
```

**When NOT to use this pattern:**

- Small datasets where memory pressure is not a concern
- Pre-quantized vectors from embedding model (use native format)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Quantization](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
