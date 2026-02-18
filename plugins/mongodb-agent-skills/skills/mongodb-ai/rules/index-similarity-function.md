---
title: Choosing the Right Similarity Function
impact: CRITICAL
impactDescription: Wrong similarity function returns incorrect rankings and irrelevant results
tags: similarity, cosine, euclidean, dotProduct, vector-index
---

## Choosing the Right Similarity Function

The similarity function determines how vector distances are calculated. Choosing wrong produces incorrect result rankings.

If your embedding provider doesn't give explicit guidance, MongoDB docs recommend starting with `dotProduct` and unit-normalized vectors.

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

// WRONG: Picking a similarity function by guesswork
// Similarity should follow model guidance and vector normalization behavior
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "euclidean"  // Might be incorrect for your model
  }]
})
```

**Correct (matching similarity to use case):**

```javascript
// CORRECT: dotProduct with unit-normalized vectors
// Good default when model docs don't prescribe a specific metric
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "dotProduct"
  }]
})

// CORRECT: cosine when your model guidance explicitly expects cosine behavior
// Note: cosine can't be used with zero-magnitude vectors
db.products.createSearchIndex("vector_index_cosine", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})

// CORRECT: euclidean for distance-based use cases
db.images.createSearchIndex("image_vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 512,
    similarity: "euclidean"
  }]
})
```

**Similarity Function Guide:**

| Function | Best For | Pre-normalized? | Notes |
|----------|----------|-----------------|-------|
| `dotProduct` | Default when model guidance is unclear | Yes (required) | Efficient and docs-recommended starting point |
| `cosine` | Models explicitly tuned for cosine similarity | Not required, but vectors must be non-zero | Docs recommend normalizing + `dotProduct` for cosine-like behavior |
| `euclidean` | Distance-oriented embeddings/use cases | No | Use when model guidance indicates distance metric |

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
