---
title: Route Lexical Prefilter Wiring to mongodb-search
impact: CRITICAL
impactDescription: Prevents mixing MQL metadata filters with Atlas Search operator filters
tags: lexical-prefilter, vectorSearch-operator, $search, boundary, preview
---

## Route Lexical Prefilter Wiring to mongodb-search

Current MongoDB docs separate two different filter surfaces:

- `$vectorSearch.filter` for supported MQL-style metadata filters
- `$search.vectorSearch.filter` for Atlas Search operator filters such as `text`, `phrase`, `wildcard`, and `geoWithin`

This skill owns the retrieval-strategy decision:

- use `$vectorSearch` when MQL metadata filtering is enough
- switch to `$search.vectorSearch` when you need analyzed lexical filters before vector retrieval

`mongodb-search` owns the detailed wiring:

- Atlas Search operator composition
- analyzer and mapping choices
- preview/GA gating for `vectorSearch` operator features
- hybrid stage legality when the query also uses `$rankFusion` or `$scoreFusion`

**Incorrect (trying to use Atlas Search operators inside `$vectorSearch.filter`):**

```javascript
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: {
        text: {
          query: "laptop",
          path: "description",
          fuzzy: { maxEdits: 1 }
        }
      }
    }
  }
])
```

**Correct (keep MQL metadata filters here and route Atlas Search operator wiring to `mongodb-search`):**

```javascript
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 10,
      filter: {
        category: "electronics",
        price: { $gte: 500, $lte: 2500 }
      }
    }
  }
])
```

**When NOT to use this pattern:**

- You need exact operator syntax, analyzer choices, or deployment/version gating. Use `mongodb-search`.

## Verify with

1. Confirm whether your filter is MQL metadata filtering or Atlas Search operator filtering.
2. If it is Atlas Search operator filtering, switch to `mongodb-search` before generating the final pipeline.
3. Validate on the target deployment and release line before rollout.

Reference: [Atlas $vectorSearch Stage](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)
Reference: [MongoDB vectorSearch Operator](https://mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/)
