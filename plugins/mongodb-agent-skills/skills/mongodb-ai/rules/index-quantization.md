---
title: Vector Quantization for Scale
impact: CRITICAL
impactDescription: Reduces RAM usage by 3.75x-24x for large vector datasets
tags: quantization, scalar, binary, int8, int1, RAM, performance
---

## Vector Quantization for Scale

Quantization compresses vectors to reduce RAM usage. Essential for datasets over 100K vectors. Scalar reduces RAM by 3.75x, binary by 24x.

**Incorrect (no quantization on large dataset):**

```javascript
// WRONG: 1M vectors at 1536 dimensions without quantization
// RAM usage: ~6GB just for vectors + HNSW graph
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
// CORRECT: Scalar quantization (3.75x RAM reduction)
// Good for most embedding models
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "scalar"  // int8 quantization
  }]
})

// CORRECT: Binary quantization (24x RAM reduction)
// Best for normalized embeddings (OpenAI, Voyage AI)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "binary"  // int1 quantization with rescoring
  }]
})
```

**Quantization Comparison:**

| Type | RAM Reduction | Accuracy | Best For |
|------|---------------|----------|----------|
| `none` | 1x (baseline) | Highest | < 100K vectors |
| `scalar` | 3.75x | Good | Most models, < 1M vectors |
| `binary` | 24x | Good* | Normalized embeddings, > 1M vectors |

*Binary uses rescoring to maintain accuracy

**RAM Calculation Example:**

```
Without quantization:
  1M vectors × 1536 dims × 4 bytes = 6.14 GB

With scalar quantization:
  1M vectors × 1536 dims × 1 byte + HNSW = ~1.64 GB

With binary quantization:
  1M vectors × 1536 dims × 0.125 bytes + rescoring = ~0.26 GB
```

**When to Enable Quantization:**

```javascript
// Check your vector count
db.products.countDocuments({ embedding: { $exists: true } })

// Rule of thumb:
// < 100K vectors: quantization optional
// 100K - 1M vectors: use scalar
// > 1M vectors: use binary
```

**How to Verify RAM Usage:**

```javascript
// Check index size in Atlas UI:
// Clusters > Collection > Search Indexes > Size / Required Memory

// Or via aggregation (estimate):
db.products.aggregate([
  { $collStats: { storageStats: {} } }
])
```

**When NOT to use this pattern:**

- Small datasets (< 100K vectors) where accuracy is paramount
- When using low-dimensional models (< 256 dims) - less benefit
- Pre-quantized vectors from embedding model (use native format)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Quantization](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
