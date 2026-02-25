---
title: Use $searchMeta for Facet-Only Metadata Workloads
impact: HIGH
impactDescription: Improves efficiency and reduces response complexity for faceting
tags: searchMeta, facet, metadata, query-pipeline
---

## Use $searchMeta for Facet-Only Metadata Workloads

**Impact: HIGH (facet-only queries are less efficient when run through `$search` result pipelines)**

For metadata-only facet responses, prefer `$searchMeta`. Use `$search` with `$$SEARCH_META` only when you need documents and facet metadata in one request.

**Incorrect (using `$search` for facet-only API):**

```javascript
db.products.aggregate([
  {
    $search: {
      facet: {
        operator: { text: { query: "laptop", path: "description" } },
        facets: { brands: { type: "string", path: "brand" } }
      }
    }
  }
])
```

**Correct (`$searchMeta` for facet-only):**

```javascript
db.products.aggregate([
  {
    $searchMeta: {
      facet: {
        operator: { text: { query: "laptop", path: "description" } },
        facets: { brands: { type: "string", path: "brand" } }
      }
    }
  }
])
```

**How to verify:**

- Facet endpoint returns only metadata payload from `$searchMeta`.
- Mixed endpoints explicitly use `$$SEARCH_META` with `$search`.

**When NOT to use this pattern:**

- You must return full documents and facet metadata in one pipeline response.

Reference: [facet Collector](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/facet.md)
Reference: [$searchMeta Stage](https://www.mongodb.com/docs/atlas/atlas-search/aggregation-stages/searchMeta.md)
