---
title: Hybrid Search Limitations
impact: MEDIUM
impactDescription: Understanding constraints prevents runtime errors
tags: hybrid, rankFusion, scoreFusion, limitations, constraints
---

## Hybrid Search Limitations

`$rankFusion` and `$scoreFusion` have specific constraints. Understanding them prevents errors.

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

**Allowed Stages in Sub-Pipelines:**

| Stage | Allowed | Notes |
|-------|---------|-------|
| `$vectorSearch` | Yes | Vector search |
| `$search` | Yes | Full-text search |
| `$match` | Yes | Filter documents |
| `$sort` | Yes | Re-order results |
| `$limit` | Yes | Limit results |
| `$geoNear` | Yes | Geographic search |
| `$project` | **No** | Use after $rankFusion |
| `$group` | **No** | Not supported |
| `$lookup` | **No** | Same collection only |
| `$unwind` | **No** | Not supported |

**Key Limitations:**

```javascript
// 1. MongoDB 8.0+ required for $rankFusion
// 2. MongoDB 8.2+ required for $scoreFusion

// 3. Sub-pipelines run SERIALLY (not parallel)
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

// 4. No pagination support
// Can't use skip/limit across fused results
// Workaround: Request more results and paginate in application

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

Reference: [MongoDB Hybrid Search Limitations](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/#limitations)
