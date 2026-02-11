---
title: Enable Quantization at Scale
impact: HIGH
impactDescription: 3.75x-24x RAM reduction for large vector datasets
tags: quantization, scale, RAM, performance, 100k
---

## Enable Quantization at Scale

Enable quantization when your vector count exceeds 100K. Without quantization, large datasets require excessive RAM and slow performance.

**Incorrect (no quantization on large dataset):**

```javascript
// WRONG: 500K vectors without quantization
// RAM required: ~3GB just for vectors
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
// Dataset size determines quantization type
const vectorCount = await db.products.countDocuments({ embedding: { $exists: true } })

if (vectorCount > 1000000) {
  // > 1M vectors: Use binary (24x reduction)
  db.products.createSearchIndex("vector_index", "vectorSearch", {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine",
      quantization: "binary"
    }]
  })
} else if (vectorCount > 100000) {
  // 100K-1M vectors: Use scalar (3.75x reduction)
  db.products.createSearchIndex("vector_index", "vectorSearch", {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine",
      quantization: "scalar"
    }]
  })
}
```

**RAM Calculation Guide:**

```
Base RAM per vector:
  numDimensions × 4 bytes (float32)
  1536 dims × 4 = 6,144 bytes = 6 KB

Without quantization (1M vectors × 1536 dims):
  1,000,000 × 6 KB = 6 GB

With scalar quantization:
  6 GB / 3.75 = 1.6 GB

With binary quantization:
  6 GB / 24 = 0.25 GB
```

**Decision Matrix:**

| Vector Count | Quantization | RAM (1536 dims) |
|--------------|--------------|-----------------|
| < 100K | none | < 600 MB |
| 100K - 500K | scalar | 160 - 800 MB |
| 500K - 1M | scalar or binary | 160 MB - 1.6 GB |
| > 1M | binary | < 1 GB |

**Monitoring Vector Index Size:**

```javascript
// Check index status and size
db.products.getSearchIndexes().forEach(idx => {
  if (idx.type === "vectorSearch") {
    print(`Index: ${idx.name}`)
    print(`Status: ${idx.status}`)
    print(`Queryable: ${idx.queryable}`)
  }
})

// Atlas UI: Check "Required Memory" metric
// Path: Database > Collections > Search Indexes > vector_index
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
      quantization: "binary"  // Add quantization
    }]
  }
})
```

**When NOT to use this pattern:**

- Small datasets (< 100K vectors) where accuracy is critical
- Already using pre-quantized embeddings from model
- Testing/development environments

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Quantization](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
