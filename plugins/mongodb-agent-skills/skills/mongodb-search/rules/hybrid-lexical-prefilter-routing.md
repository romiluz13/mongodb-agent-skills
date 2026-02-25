---
title: Route Prefilters Between $vectorSearch and $search.vectorSearch Correctly
impact: HIGH
impactDescription: Enables advanced lexical filtering without invalid stage usage
tags: hybrid, vector, prefilter, fuzzy, phrase
---

## Route Prefilters Between $vectorSearch and $search.vectorSearch Correctly

**Impact: HIGH (wrong prefilter surface causes unsupported query errors)**

Use `$vectorSearch` stage filters for MQL-style metadata filters. Use `$search.vectorSearch` operator when you need analyzed lexical filters such as fuzzy, phrase, wildcard, or geo operators.

**Incorrect (using fuzzy semantics in `$vectorSearch` filter):**

```javascript
db.docs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [0.1, 0.2],
      numCandidates: 100,
      limit: 10,
      filter: {
        text: { query: "electrnics", path: "category", fuzzy: { maxEdits: 1 } }
      }
    }
  }
])
```

**Correct (advanced lexical filter via `$search.vectorSearch`):**

```javascript
db.docs.aggregate([
  {
    $search: {
      index: "hybrid_index",
      vectorSearch: {
        path: "embedding",
        queryVector: [0.1, 0.2],
        numCandidates: 100,
        limit: 10,
        filter: {
          text: {
            query: "electrnics",
            path: "category",
            fuzzy: { maxEdits: 1 }
          }
        }
      }
    }
  }
])
```

**How to verify:**

- `$vectorSearch.filter` uses only supported MQL operators.
- Advanced lexical filtering uses `$search.vectorSearch`.

**When NOT to use this pattern:**

- You only need basic equality/range prefilters.

Reference: [Atlas $vectorSearch Stage](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage.md)
Reference: [vectorSearch Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch.md)
Reference: [Atlas Vector Search Changelog](https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog.md)
