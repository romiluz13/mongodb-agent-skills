---
title: Control nGram and Autocomplete Field Growth
impact: CRITICAL
impactDescription: Prevents nGram-driven index growth and search instability
tags: ngram, autocomplete, edgegram, alerts, performance
---

## Control nGram and Autocomplete Field Growth

**Impact: CRITICAL (excessive nGram/edgeGram fields can increase index cost and failure risk)**

Treat `Search Max nGram Fields Indexed` as a design warning. Keep autocomplete fields targeted, prefer `edgeGram` for prefix use cases, and avoid applying nGram-heavy mappings to broad dynamic surfaces.

**Incorrect (nGram everywhere):**

```javascript
db.catalog.createSearchIndex("default", {
  mappings: {
    dynamic: true,
    fields: {
      title: { type: "autocomplete", tokenization: "nGram", minGrams: 2, maxGrams: 20 },
      description: { type: "autocomplete", tokenization: "nGram", minGrams: 2, maxGrams: 20 }
    }
  }
})
```

**Correct (targeted autocomplete strategy):**

```javascript
db.catalog.createSearchIndex("autocomplete_index", {
  mappings: {
    dynamic: false,
    fields: {
      title: {
        type: "autocomplete",
        tokenization: "edgeGram",
        minGrams: 2,
        maxGrams: 15
      }
    }
  }
})
```

**How to verify:**

- Search Max nGram Fields Indexed metric trends down or stabilizes.
- Query latency and index build time are within SLOs.

**When NOT to use this pattern:**

- Linguistic use cases that explicitly require nGram behavior and have measured capacity headroom.

Reference: [Atlas Alert Conditions](https://www.mongodb.com/docs/atlas/reference/alert-conditions.md)
Reference: [Autocomplete Field Type](https://www.mongodb.com/docs/atlas/atlas-search/field-types/autocomplete-type.md)
Reference: [Review Atlas Search Metrics](https://www.mongodb.com/docs/atlas/review-atlas-search-metrics.md)
