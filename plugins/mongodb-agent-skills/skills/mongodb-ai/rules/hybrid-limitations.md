---
title: Hybrid Search Limitations
impact: MEDIUM
impactDescription: Understanding constraints prevents runtime errors
tags: hybrid, rankFusion, scoreFusion, limitations, constraints
---

## Hybrid Search Limitations

`$rankFusion` and `$scoreFusion` have specific constraints. Understanding them prevents errors.

Fusion-stage behavior has evolved quickly across 8.0-8.2+. Keep rollout plans conservative and validate on your exact target release.

For search-engine-first hybrid pipeline wiring (`$search`, analyzers, stage legality, and operational gates), use `mongodb-search`. This rule stays focused on retrieval-strategy constraints and rollout cautions.

**Hybrid strategy decision matrix (docs-first):**

| Goal | Primary Pattern | Minimum MongoDB Version | Why |
|------|-----------------|-------------------------|-----|
| Stable baseline hybrid retrieval | `$rankFusion` | 8.0+ (`$vectorSearch` in input: 8.1+) | Rank-based fusion, simple weighting, broadest compatibility |
| Score-aware hybrid tuning | `$scoreFusion` | 8.2+ | Uses score magnitudes, normalization, custom expressions |
| Highest top-k precision | Retrieval (`$vectorSearch` / fusion) + external reranker | Retrieval stage per selected pattern | Two-stage flow can improve final ordering after candidate retrieval |

If you run retrieval + rerank, keep MongoDB guidance focused on candidate quality (`numCandidates`, filters, hybrid weights), then apply reranking in application/provider logic.

**Incorrect (violating limitations):**

```javascript
// WRONG: Using $project in sub-pipeline
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [
            { $vectorSearch: { ... } },
            { $project: { title: 1 } }  // NOT ALLOWED!
          ]
        }
      }
    }
  }
])
// Error: $project not supported in $rankFusion sub-pipelines

// WRONG: Cross-collection search
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          products: [{ $vectorSearch: { index: "products_vector", ... } }],
          reviews: [
            { $lookup: { from: "reviews", ... } }  // NOT ALLOWED!
          ]
        }
      }
    }
  }
])
// Error: All pipelines must search same collection
```

**Correct (working within constraints):**

```javascript
// Project AFTER $rankFusion, not inside
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
            { $limit: 20 }  // $limit IS allowed
          ]
        }
      }
    }
  },
  { $limit: 10 },
  { $project: { title: 1, description: 1 } }  // Project AFTER
])
```

For the exact allowed-stage matrix and version/legality checks, defer to `mongodb-search`.

**Key Limitations:**

```javascript
// 1. MongoDB 8.0+ required for $rankFusion
// 2. MongoDB 8.2+ required for $scoreFusion

// 3. Sub-pipelines execute independently
// Performance tip: Limit results in each sub-pipeline
{
  $rankFusion: {
    input: {
      pipelines: {
        a: [{ $vectorSearch: { ..., limit: 20 } }],  // Limit here
        b: [{ $search: { ... } }, { $limit: 20 }]    // Limit here
      }
    }
  }
}

// 4. No stable global pagination across fused output
// End-to-end paging over fused/merged output is release-sensitive.
// Workaround: Request a larger window and paginate in application code.

// 5. Same collection only
// For cross-collection, use $unionWith separately
db.products.aggregate([
  {
    $unionWith: {
      coll: "reviews",
      pipeline: [
        { $vectorSearch: { index: "reviews_vector", ... } }
      ]
    }
  },
  // Then sort/rank manually
  { $sort: { score: -1 } },
  { $limit: 10 }
])

// 6. No storedSource fields from $search
// Can't use returnStoredSource with $rankFusion

// 7. Release-sensitive behavior
// Re-check release notes before upgrades because fusion-stage behavior and constraints can evolve.
```

**Cross-Collection Alternative:**

```javascript
// Use $unionWith for multi-collection search
async function crossCollectionSearch(query) {
  const queryEmbedding = await embed(query)

  return db.products.aggregate([
    // Search products
    {
      $vectorSearch: {
        index: "products_vector",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10
      }
    },
    { $addFields: { source: "products", score: { $meta: "vectorSearchScore" } } },

    // Union with reviews search
    {
      $unionWith: {
        coll: "reviews",
        pipeline: [
          {
            $vectorSearch: {
              index: "reviews_vector",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 10
            }
          },
          { $addFields: { source: "reviews", score: { $meta: "vectorSearchScore" } } }
        ]
      }
    },

    // Combine and sort
    { $sort: { score: -1 } },
    { $limit: 10 }
  ]).toArray()
}
```

**When NOT to use this pattern:**

- Need cross-collection search (use $unionWith)
- Need pagination (implement in application layer)
- Need complex transformations in sub-pipelines

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Hybrid Search Limitations](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/#limitations)
