---
title: Hybrid Search with $rankFusion
impact: MEDIUM
impactDescription: Combines semantic and lexical search for better recall
tags: hybrid, rankFusion, vector-search, text-search, MongoDB-8
---

## Hybrid Search with $rankFusion

`$rankFusion` (MongoDB 8.0+) combines vector search and text search results using Reciprocal Rank Fusion.

**Incorrect (separate queries):**

```javascript
// WRONG: Running separate queries and merging manually
const vectorResults = await db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  }
]).toArray()

const textResults = await db.products.aggregate([
  {
    $search: {
      index: "text_index",
      text: { query: "laptop", path: "description" }
    }
  },
  { $limit: 10 }
]).toArray()

// Manual merge is complex and error-prone
```

**Correct (using $rankFusion):**

```javascript
// CORRECT: Single hybrid query with $rankFusion
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          // Vector (semantic) search
          vector: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 20
              }
            }
          ],
          // Text (lexical) search
          text: [
            {
              $search: {
                index: "text_index",
                text: {
                  query: "laptop for programming",
                  path: "description"
                }
              }
            },
            { $limit: 20 }
          ]
        }
      }
    }
  },
  { $limit: 10 },
  {
    $project: {
      title: 1,
      description: 1,
      score: { $meta: "score" }  // Combined rank score
    }
  }
])
```

**With Weights (prioritize one method):**

```javascript
// Weight vector search higher for conceptual queries
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 20
              }
            }
          ],
          text: [
            {
              $search: {
                index: "text_index",
                text: { query: searchTerm, path: "description" }
              }
            },
            { $limit: 20 }
          ]
        },
        weights: {
          vector: 0.7,  // Semantic weight
          text: 0.3     // Lexical weight
        }
      }
    }
  },
  { $limit: 10 }
])

// Weight text search higher for exact term queries
// weights: { vector: 0.3, text: 0.7 }
```

**Prerequisites:**

```javascript
// 1. Vector search index
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})

// 2. Atlas Search index for text
db.products.createSearchIndex("text_index", "search", {
  mappings: {
    dynamic: false,
    fields: {
      description: { type: "string", analyzer: "lucene.standard" },
      title: { type: "string", analyzer: "lucene.standard" }
    }
  }
})
```

**Reciprocal Rank Fusion Formula:**

```
For each document in results:
  score = sum( weight[i] × (1 / (rank[i] + 60)) )

Where:
  - rank[i] is the document's position in pipeline i
  - 60 is the smoothing constant (fixed)
  - weight[i] is the pipeline weight
```

**When NOT to use this pattern:**

- MongoDB version < 8.0 (not supported)
- Only semantic search needed (use $vectorSearch alone)
- Only exact matching needed (use $search alone)
- Cross-collection search (use $unionWith instead)

Reference: [MongoDB Hybrid Search](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/)
