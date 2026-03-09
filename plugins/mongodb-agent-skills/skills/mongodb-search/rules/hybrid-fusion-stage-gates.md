---
title: Enforce Version and Stage Gates for Fusion Pipelines
impact: HIGH
impactDescription: Prevents runtime failures in hybrid pipeline orchestration
tags: rankFusion, scoreFusion, version-gates, hybrid
---

## Enforce Version and Stage Gates for Fusion Pipelines

**Impact: HIGH (unsupported fusion usage fails at runtime)**

`$rankFusion` requires MongoDB 8.0+, `$scoreFusion` requires MongoDB 8.2+. Both require same-collection pipelines, but their allowed selection-pipeline stages are not identical.

`$rankFusion` selection pipelines accept only:
| Search Stages | $match, $search, $vectorSearch, $sample, $geoNear |
| Ordering Stages | $sort |
| Pagination Stages | $skip, $limit |

`$scoreFusion` selection pipelines accept only:
| Search Stages | $match, $search, $vectorSearch, $geoNear |
| Ordering Stages | $sort |
| Pagination Stages | $skip, $limit |
| Scoring Stages | $score |

Any other stage causes an error. Use `$score` in `$scoreFusion` when a pipeline otherwise would not produce a score.

For reranking, use `$rankFusion` (RRF) or `$scoreFusion`, or call an external reranking API from application code.

**Incorrect (invalid version and stage usage):**

```javascript
// WRONG: using $scoreFusion on 8.0 and unsupported $project in subpipeline
{
  $scoreFusion: {
    input: {
      pipelines: {
        p1: [{ $search: { text: { query: "a", path: "title" } } }, { $project: { title: 1 } }]
      }
    }
  }
}
```

**Correct (gated fusion plan):**

```javascript
// 1) Check server version before choosing fusion operator.
// 2) Keep selection pipelines to the operator-specific allowed stages only.
// 3) For $scoreFusion, ensure each pipeline returns a score.
{
  $scoreFusion: {
    input: {
      normalization: "none",
      pipelines: {
        lexical: [{ $search: { text: { query: "laptop", path: "description" } } }, { $limit: 50 }],
        semantic: [{ $vectorSearch: { index: "vector_idx", path: "embedding", queryVector: [0.1, 0.2], numCandidates: 200, limit: 50 } }],
        categoryBoost: [
          { $match: { category: "electronics" } },
          { $score: { score: 0.15 } }
        ]
      }
    },
    combination: {
      method: "avg"
    }
  }
}
```

**How to verify:**

- Deployment version is validated before pipeline generation.
- `rankFusion` pipelines pass allowed-stage checks (`$match`, `$search`, `$vectorSearch`, `$sample`, `$geoNear`, `$sort`, `$skip`, `$limit`).
- `scoreFusion` pipelines pass allowed-stage checks (`$match`, `$search`, `$vectorSearch`, `$geoNear`, `$sort`, `$skip`, `$limit`, `$score`).
- `rankFusion`/`scoreFusion` pipelines run against one collection only.
- For `$scoreFusion`, each pipeline returns a score (or includes `$score` when needed).

**When NOT to use this pattern:**

- Single retrieval method is enough and fusion is unnecessary.

Reference: [$rankFusion](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion.md)
Reference: [$scoreFusion](https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion.md)
Reference: [Hybrid Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search.md)
