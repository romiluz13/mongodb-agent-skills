---
title: Score-Based Hybrid Search with $scoreFusion
impact: MEDIUM
impactDescription: Fine-grained score combination for improved relevance tuning
tags: hybrid, scoreFusion, vector-search, text-search, MongoDB-8.2, normalization
---

## Score-Based Hybrid Search with $scoreFusion

`$scoreFusion` (MongoDB 8.2+) combines multiple search pipelines using actual scores rather than ranks, with support for normalization and custom combination expressions.

As documented in current MongoDB 8.2 docs, fusion stages are Preview features. Re-validate behavior and compatibility assumptions on every release upgrade.

**Feature maturity note:** validate behavior against current release notes before production rollout because fusion-stage capabilities can evolve between MongoDB release lines.

**$scoreFusion vs $rankFusion:**

| Feature | $rankFusion | $scoreFusion |
|---------|-------------|--------------|
| MongoDB Version | 8.0+ | 8.2+ |
| Combination Method | Reciprocal Rank Fusion | Score-based arithmetic |
| Normalization | None | sigmoid, minMaxScaler, none |
| Custom Expressions | No | Yes |
| Score Details | No | Yes |

**Incorrect (using $rankFusion when scores matter):**

```javascript
// WRONG: $rankFusion ignores actual score values
// A document at rank 1 with score 0.99 is treated the same
// as rank 1 with score 0.51 - losing precision
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }]
        },
        weights: { vector: 0.5, text: 0.5 }
      }
    }
  }
])
// Result: High-confidence matches not distinguished from marginal ones
```

**Correct (using $scoreFusion for score-aware combination):**

```javascript
// CORRECT: $scoreFusion uses actual scores with normalization
db.products.aggregate([
  {
    $scoreFusion: {
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
        },
        normalization: "sigmoid"  // Normalize scores to 0-1
      },
      combination: {
        weights: { vector: 0.6, text: 0.4 }
        // Default method: "avg" - weighted average of normalized scores
      }
    }
  },
  { $limit: 10 }
])
```

**Custom Score Expression:**

```javascript
// Use custom arithmetic expression for fine-grained control
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          semantic: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          lexical: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "title" }
            }
          }, { $limit: 20 }]
        },
        normalization: "minMaxScaler"
      },
      combination: {
        method: "expression",
        expression: {
          // Custom formula: weight semantic higher, boost exact matches
          $sum: [
            { $multiply: ["$$semantic", 10] },
            "$$lexical"
          ]
        }
      }
    }
  },
  { $limit: 10 }
])
```

**Score Details for Debugging:**

```javascript
// Enable scoreDetails to understand score composition
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }]
        },
        normalization: "sigmoid"
      },
      combination: {
        weights: { vector: 0.7, text: 0.3 }
      },
      scoreDetails: true  // Include detailed scoring info
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "score" },
      scoreDetails: { $meta: "scoreDetails" }
      // scoreDetails contains: value, description, normalization,
      // combination method, and per-pipeline breakdown
    }
  },
  { $limit: 10 }
])
```

**Normalization Methods:**

| Method | Description | Use Case |
|--------|-------------|----------|
| `none` | No normalization | Scores already comparable |
| `sigmoid` | Apply sigmoid function | Different score distributions |
| `minMaxScaler` | Scale to 0-1 range | Varying score magnitudes |

**When to use $scoreFusion over $rankFusion:**

- Need fine-grained control over score combination
- Want to distinguish high-confidence from marginal matches
- Need custom arithmetic expressions for scoring
- Debugging requires score breakdown details
- Score magnitudes are meaningful to your application

**When NOT to use this pattern:**

- MongoDB version < 8.2 (use $rankFusion instead)
- Simple hybrid search without score tuning needs
- Rank-based fusion is sufficient for your use case
- Performance-critical with minimal complexity needs

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB $scoreFusion](https://mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/)
