---
title: numDimensions Must Match Embedding Model
impact: CRITICAL
impactDescription: Mismatched dimensions break indexing or query correctness
tags: numDimensions, embedding-model, dimensions, vector-index
---

## numDimensions Must Match Embedding Model

The `numDimensions` in your index must exactly match the length of the vectors you index and query. MongoDB docs currently support up to `8192` dimensions for the vector field type.

**Incorrect (wrong dimensions):**

```javascript
// WRONG: Stored/query vectors are length 1024
// but the index is defined as 768
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 768,
    similarity: "cosine"
  }]
})
// Result: indexing/querying will fail or behave incorrectly

// WRONG: Guessing dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 512,  // Guessing is dangerous
    similarity: "cosine"
  }]
})

// WRONG: Exceeding maximum supported dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 9000,  // Exceeds maximum supported (8192)
    similarity: "cosine"
  }]
})
```

**Correct (matching model dimensions):**

```javascript
// CORRECT: Match the actual vector length you store and query
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1024,
    similarity: "cosine"
  }]
})
```

Provider output dimensions are provider-defined. Treat the provider response and a sample of stored vectors as the source of truth before creating or changing the index.

**How to Check Your Embedding Dimensions:**

```javascript
// Check actual vector length in your data
db.products.aggregate([
  { $match: { embedding: { $exists: true } } },
  { $limit: 1 },
  { $project: { dimensions: { $size: "$embedding" } } }
])
// Output: { dimensions: 1024 }

// Verify all vectors have consistent dimensions
db.products.aggregate([
  { $match: { embedding: { $exists: true } } },
  { $group: {
    _id: { $size: "$embedding" },
    count: { $sum: 1 }
  }}
])
// Should return single result if consistent
```

**Troubleshooting Zero Results:**

```javascript
// 1. Check if documents are being indexed
db.products.countDocuments({ embedding: { $exists: true, $type: "array" } })

// 2. Check vector length matches index
db.products.findOne({ embedding: { $exists: true } }, { "embedding": { $slice: 1 } })

// 3. Check index status
db.products.getSearchIndexes()
// Look for "status": "READY"
```

**When NOT to use this pattern:**

- Using variable-length sparse vectors (not supported)
- Changing embedding models (requires re-embedding all data)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Index Definition](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-numDimensions)
