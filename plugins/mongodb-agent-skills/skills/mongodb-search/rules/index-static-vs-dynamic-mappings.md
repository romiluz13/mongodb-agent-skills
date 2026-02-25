---
title: Constrain Dynamic Mappings and Prefer Static Index Definitions
impact: CRITICAL
impactDescription: Prevents field explosion and index bloat
tags: mappings, dynamic, static, typeset, index-design
---

## Constrain Dynamic Mappings and Prefer Static Index Definitions

**Impact: CRITICAL (unbounded dynamic indexing degrades indexing and query performance)**

Use static mappings for stable schemas. If you need dynamic behavior, scope it to specific `document` fields and use `typeSet` to constrain indexed types.

**Incorrect (root-level dynamic indexing everywhere):**

```javascript
db.products.createSearchIndex("default", {
  mappings: {
    dynamic: true
  }
})
```

**Correct (static root + scoped dynamic):**

```javascript
db.products.createSearchIndex("default", {
  mappings: {
    dynamic: false,
    fields: {
      tenantId: { type: "token" },
      metadata: {
        type: "document",
        dynamic: { typeSet: "metadataTypes" }
      }
    }
  },
  typeSets: [
    {
      name: "metadataTypes",
      types: [{ type: "token" }, { type: "number" }, { type: "date" }]
    }
  ]
})
```

**How to verify:**

- Review mapping to ensure `dynamic: true` is not set at root unless justified.
- Track Search Max Fields Indexed metric for growth trend.

**When NOT to use this pattern:**

- Exploratory datasets where schema is intentionally unknown and short-lived.

Reference: [Define Field Mappings](https://www.mongodb.com/docs/atlas/atlas-search/define-field-mappings.md)
Reference: [Review Atlas Search Metrics](https://www.mongodb.com/docs/atlas/review-atlas-search-metrics.md)
