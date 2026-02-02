---
title: Rank-Based Hybrid Search with $rankFusion
impact: MEDIUM
impactDescription: Combines semantic and lexical search using Reciprocal Rank Fusion
tags: hybrid, rankFusion, vector-search, text-search, MongoDB-8.0, RRF
---

## Rank-Based Hybrid Search with $rankFusion

`$rankFusion` (MongoDB 8.0+) combines vector search and text search results using Reciprocal Rank Fusion (RRF) algorithm.

**$rankFusion vs $scoreFusion:**

| Feature | $rankFusion | $scoreFusion |
|---------|-------------|--------------|
| MongoDB Version | 8.0+ | 8.2+ |
| Algorithm | Reciprocal Rank Fusion | Score-based arithmetic |
| Uses | Document position/rank | Actual score values |
| Normalization | None (rank-based) | sigmoid, minMaxScaler, none |
| Custom Expressions | No | Yes |

**Incorrect (separate queries and manual merge):**

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

// Manual merge is complex, error-prone, and loses ranking info
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
      score: { $meta: "score" }  // RRF combined score
    }
  }
])
```

**With Weights (prioritize one method):**

```javascript
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          text: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "description" }
            }
          }, { $limit: 20 }]
        }
      },
      combination: {
        weights: {
          vector: 0.7,  // Semantic weight
          text: 0.3     // Lexical weight
        }
      }
    }
  },
  { $limit: 10 }
])
```

**Score Details for Debugging:**

```javascript
// Enable scoreDetails to understand rank composition
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }, { $limit: 20 }]
        }
      },
      combination: {
        weights: { vector: 0.7, text: 0.3 }
      },
      scoreDetails: true  // Include detailed ranking info
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "score" },
      scoreDetails: { $meta: "scoreDetails" }
      // scoreDetails contains: value, description, and per-pipeline
      // breakdown with rank, weight, and inputPipelineName
    }
  },
  { $limit: 10 }
])
```

**Reciprocal Rank Fusion Formula:**

```
RRF_score(doc) = Σ weight[i] × (1 / (rank[i] + 60))

Where:
  - rank[i] = document's position in pipeline i (1-indexed)
  - 60 = smoothing constant (fixed by MongoDB)
  - weight[i] = pipeline weight (default: 1)
```

Example: Document at rank 1 in vector (weight=0.7) and rank 3 in text (weight=0.3):
```
RRF = 0.7 × (1/61) + 0.3 × (1/63) = 0.01148 + 0.00476 = 0.01624
```

**Allowed Stages in Sub-Pipelines:**

| Type | Allowed Stages |
|------|----------------|
| Search | `$vectorSearch`, `$search`, `$match`, `$geoNear`, `$sample` |
| Ordering | `$sort` |
| Pagination | `$skip`, `$limit` |

**Key Behaviors:**

- **De-duplication**: Documents appear at most once in output, even if matched by multiple pipelines
- **Single collection only**: Cannot span multiple collections (use `$unionWith` for cross-collection)
- **Pipeline names**: Cannot start with `$`, cannot contain `.` or null character

**When to use $rankFusion over $scoreFusion:**

- MongoDB 8.0 or 8.1 (before 8.2)
- Position/rank matters more than score magnitude
- Simpler hybrid search without normalization needs
- Established RRF algorithm behavior desired

**When NOT to use this pattern:**

- MongoDB version < 8.0 (not supported)
- Only semantic search needed (use $vectorSearch alone)
- Only exact matching needed (use $search alone)
- Need fine-grained score control (use $scoreFusion in 8.2+)
- Cross-collection search (use $unionWith)

Reference: [MongoDB $rankFusion](https://mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/)
