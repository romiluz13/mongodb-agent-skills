---
title: $vectorSearch Must Be First Pipeline Stage
impact: CRITICAL
impactDescription: $vectorSearch after any other stage causes aggregation error
tags: vectorSearch, pipeline, first-stage, aggregation
---

## $vectorSearch Must Be First Pipeline Stage

The `$vectorSearch` stage must be the first stage in any pipeline where it appears. Placing it after `$match`, `$project`, or any other stage in that same pipeline causes an error.

**Incorrect (not first stage):**

```javascript
// WRONG: $match before $vectorSearch
db.products.aggregate([
  { $match: { status: "active" } },  // ERROR: Cannot be before $vectorSearch
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  }
])
// Error: $vectorSearch is only valid as the first stage in a pipeline

// WRONG: $project before $vectorSearch
db.products.aggregate([
  { $project: { embedding: 1, title: 1 } },
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  }
])
// Error: $vectorSearch is only valid as the first stage in a pipeline
```

**MongoDB 8.0+ nuance (`$unionWith` support):**

```javascript
// Allowed: $vectorSearch inside a $unionWith sub-pipeline (MongoDB 8.0+)
// But it must still be first inside that sub-pipeline
db.products.aggregate([
  {
    $vectorSearch: {
      index: "product_vectors",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5
    }
  },
  {
    $unionWith: {
      coll: "archived_products",
      pipeline: [
        {
          $vectorSearch: {
            index: "archived_product_vectors",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 200,
            limit: 5
          }
        }
      ]
    }
  }
])
```

**Correct ($vectorSearch first, then other stages):**

```javascript
// CORRECT: $vectorSearch first
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  },
  { $match: { status: "active" } },  // Post-filter OK
  { $project: { title: 1, description: 1, score: { $meta: "vectorSearchScore" } } }
])

// CORRECT: Use filter parameter for pre-filtering (NOT $match)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: { status: "active" }  // Pre-filter via filter parameter
    }
  },
  { $project: { title: 1, score: { $meta: "vectorSearchScore" } } }
])
```

**Pre-filtering vs Post-filtering:**

```javascript
// PRE-FILTERING (efficient - filters before vector comparison)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: { category: "electronics" }  // GOOD: Uses indexed filter
    }
  }
])

// POST-FILTERING (less efficient - filters after vector search)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  },
  { $match: { category: "electronics" } }  // Less efficient, may return < 10 results
])
```

**Common Pipeline Pattern:**

```javascript
db.products.aggregate([
  // Stage 1: Vector search (MUST BE FIRST)
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10,
      filter: { status: "active" }
    }
  },
  // Stage 2: Add score
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" }
    }
  },
  // Stage 3: Project final fields
  {
    $project: {
      _id: 1,
      title: 1,
      description: 1,
      score: 1
    }
  }
])
```

**When NOT to use this pattern:**

- Using $search for text search (different stage, different rules)
- Hybrid search with $rankFusion (uses sub-pipelines)
- Views on MongoDB < 8.0 (not supported)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB $vectorSearch Stage](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)
