---
title: Control Search Result Shape with highlight and Stored Source
impact: HIGH
impactDescription: Reduces payload costs and enables reliable UX output
tags: highlight, storedSource, returnStoredSource, returnScope
---

## Control Search Result Shape with highlight and Stored Source

**Impact: HIGH (default full-document fetch can increase latency and cost)**

Use `highlight` for explainable UX snippets and `returnStoredSource` for lean payloads when your index defines `storedSource`. Use `returnScope` only with embedded-document retrieval requirements, and keep the `$search` versus `$searchMeta` requirements separate.

```javascript
// In $search, returnScope REQUIRES returnStoredSource: true.
// In $searchMeta, current docs say returnStoredSource must be true
// only on clusters running MongoDB versions earlier than 8.2.

// ✅ CORRECT for $search:
{ $search: {
  returnStoredSource: true,   // ← required when using returnScope
  returnScope: { path: "reviews" },
  ...
}}

// ❌ WRONG for $search — will error:
{ $search: {
  returnScope: { path: "reviews" },  // missing returnStoredSource: true
  ...
}}

// ✅ CURRENT $searchMeta guidance on MongoDB 8.2+:
{ $searchMeta: {
  returnScope: { path: "reviews" },
  ...
}}
```

**Incorrect (always full-document fetch):**

```javascript
db.docs.aggregate([
  { $search: { text: { query: "latency", path: "body" } } },
  { $sort: { updatedAt: -1 } }
])
```

**Correct (controlled return shape):**

```javascript
db.docs.aggregate([
  {
    $search: {
      text: { query: "latency", path: "body" },
      highlight: { path: "body" },
      returnStoredSource: true
    }
  },
  {
    $project: {
      title: 1,
      highlights: { $meta: "searchHighlights" }
    }
  }
])
```

**How to verify:**

- Confirm `storedSource` exists in index definition before enabling `returnStoredSource`.
- Validate highlight output with `$meta: "searchHighlights"`.
- Validate `returnScope` behavior against the exact operator and cluster version you are targeting.

**When NOT to use this pattern:**

- You always need full documents and payload size is not a concern.

Reference: [Highlight Search Terms](https://www.mongodb.com/docs/atlas/atlas-search/highlighting.md)
Reference: [Return Stored Source Fields](https://www.mongodb.com/docs/atlas/atlas-search/return-stored-source.md)
Reference: [Query, Filter, and Retrieve Arrays of Objects](https://www.mongodb.com/docs/atlas/atlas-search/return-scope.md)
Reference: [Track Scores and Search Highlights for Search Terms](https://www.mongodb.com/docs/atlas/atlas-search/return-stored-source/#std-label-return-stored-source-score-highlight)
