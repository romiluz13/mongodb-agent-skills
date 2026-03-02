---
title: Enforce Version and Stage Gates for Fusion Pipelines
impact: HIGH
impactDescription: Prevents runtime failures in hybrid pipeline orchestration
tags: rankFusion, scoreFusion, version-gates, hybrid
---

## Enforce Version and Stage Gates for Fusion Pipelines

**Impact: HIGH (unsupported fusion usage fails at runtime)**

`$rankFusion` requires MongoDB 8.0+, `$scoreFusion` requires MongoDB 8.2+. Both require same-collection pipelines and allow only specific selection/ranking stages.

$rankFusion subpipelines accept ONLY these stages:
| Search Stages    | $match, $search, $vectorSearch, $sample, $geoNear |
| Ordering Stages  | $sort |
| Pagination Stages | $skip, $limit |

$scoreFusion subpipelines accept the same stage list.
Any other stage causes an error.

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
// 2) Keep subpipelines to allowed stages only.
// 3) For $scoreFusion, ensure each pipeline is a scoring pipeline.
{
  $scoreFusion: {
    input: {
      normalization: "none",
      pipelines: {
        lexical: [{ $search: { text: { query: "laptop", path: "description" } } }, { $limit: 50 }],
        semantic: [{ $vectorSearch: { index: "vector_idx", path: "embedding", queryVector: [0.1, 0.2], numCandidates: 200, limit: 50 } }]
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
- Subpipelines pass allowed-stage checks (`$search`, `$vectorSearch`, `$match`, `$sort`, `$geoNear`, plus pagination stages where supported; `rankFusion` also permits `$sample`).
- `rankFusion`/`scoreFusion` pipelines run against one collection only.
- For `$scoreFusion`, each pipeline returns a score (or includes `$score` when needed).

**When NOT to use this pattern:**

- Single retrieval method is enough and fusion is unnecessary.

Reference: [$rankFusion](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion.md)
Reference: [$scoreFusion](https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion.md)
Reference: [Hybrid Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search.md)
