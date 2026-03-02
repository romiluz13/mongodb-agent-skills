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

### numBuckets and Deprecated Types

- `numBuckets`: controls max string facet values returned (default: 10, max: 1000).
  If your facet has many unique values, results are truncated at 10 by default.

- Deprecated field types (you may encounter in older indexes):
  - `stringFacet` → use `token` instead
  - `numberFacet` → use `number` instead
  - `dateFacet` → use `date` instead

- For multi-select faceting (where selecting a facet should NOT exclude other facet counts),
  use `doesNotAffect` on the compound operator to maintain correct bucket counts.

**How to verify:**

- Buckets appear with expected counts in `$searchMeta` output.
- Field mappings for faceted paths are explicitly defined.

**When NOT to use this pattern:**

- No faceted navigation or grouping requirements exist.

Reference: [Facet Collector](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/facet.md)
