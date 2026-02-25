---
title: Use Facet-Compatible Field Types
impact: HIGH
impactDescription: Prevents empty or misleading facet buckets
tags: facet, token, number, date, searchMeta
---

## Use Facet-Compatible Field Types

**Impact: HIGH (wrong facet field types produce incorrect aggregations)**

Faceting requires compatible field mappings. For strings, index as `token`; for numeric/date facets, use appropriate facet-capable types.

**Incorrect (faceting untyped string field):**

```javascript
db.movies.aggregate([
  {
    $searchMeta: {
      facet: {
        facets: {
          genresFacet: { type: "string", path: "genres" }
        }
      }
    }
  }
])
```

**Correct (facet-ready mapping + query):**

```javascript
// Mapping excerpt
// genres: { type: "token" }

db.movies.aggregate([
  {
    $searchMeta: {
      facet: {
        operator: { text: { query: "space", path: "plot" } },
        facets: {
          genresFacet: { type: "string", path: "genres" }
        }
      }
    }
  }
])
```

**How to verify:**

- Buckets appear with expected counts in `$searchMeta` output.
- Field mappings for faceted paths are explicitly defined.

**When NOT to use this pattern:**

- No faceted navigation or grouping requirements exist.

Reference: [Facet Collector](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/facet.md)
