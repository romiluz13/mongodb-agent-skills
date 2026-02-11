---
title: Choosing the Right Similarity Function
impact: CRITICAL
impactDescription: Wrong similarity function returns incorrect rankings and irrelevant results
tags: similarity, cosine, euclidean, dotProduct, vector-index
---

## Choosing the Right Similarity Function

The similarity function determines how vector distances are calculated. Choosing wrong produces incorrect result rankings.

**Incorrect (mismatched similarity function):**

```javascript
// WRONG: Using dotProduct with non-normalized vectors
// dotProduct requires pre-normalized vectors (magnitude = 1)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "dotProduct"  // Incorrect if vectors aren't normalized!
  }]
})

// WRONG: Using euclidean for text embeddings
// Most text embedding models are designed for cosine similarity
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "euclidean"  // Works but suboptimal for text
  }]
})
```

**Correct (matching similarity to use case):**

```javascript
// CORRECT: cosine for text embeddings (most common)
// Works with OpenAI, Cohere, Voyage AI, etc.
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"  // Normalizes automatically
  }]
})

// CORRECT: euclidean for image/spatial embeddings
// When absolute distance matters
db.images.createSearchIndex("image_vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 512,
    similarity: "euclidean"
  }]
})

// CORRECT: dotProduct when vectors are pre-normalized
// AND you want maximum performance
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "normalized_embedding",  // Must be normalized!
    numDimensions: 1536,
    similarity: "dotProduct"
  }]
})
```

**Similarity Function Guide:**

| Function | Best For | Pre-normalized? | Notes |
|----------|----------|-----------------|-------|
| `cosine` | Text embeddings | No (auto-normalizes) | Most common choice |
| `euclidean` | Image/spatial data | No | Distance-based |
| `dotProduct` | Performance-critical | Yes (required!) | Fastest computation |

**How to Check Your Embedding Model:**

```javascript
// Check if your vectors are normalized (magnitude ≈ 1)
db.products.aggregate([
  { $limit: 1 },
  { $project: {
    magnitude: {
      $sqrt: {
        $reduce: {
          input: "$embedding",
          initialValue: 0,
          in: { $add: ["$$value", { $multiply: ["$$this", "$$this"] }] }
        }
      }
    }
  }}
])
// If magnitude ≈ 1.0, vectors are normalized
// If magnitude varies (e.g., 0.5-2.0), use cosine
```

**When NOT to use this pattern:**

- `dotProduct` with non-normalized vectors (results will be wrong)
- Changing similarity on existing index (requires rebuild)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Search Similarity](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-similarity)
