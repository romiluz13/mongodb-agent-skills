---
title: Control Search Result Shape with highlight and Stored Source
impact: HIGH
impactDescription: Reduces payload costs and enables reliable UX output
tags: highlight, storedSource, returnStoredSource, returnScope
---

## Control Search Result Shape with highlight and Stored Source

**Impact: HIGH (default full-document fetch can increase latency and cost)**

Use `highlight` for explainable UX snippets and `returnStoredSource` for lean payloads when your index defines `storedSource`. Use `returnScope` only with embedded-document retrieval requirements.

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

**When NOT to use this pattern:**

- You always need full documents and payload size is not a concern.

Reference: [Highlight Search Terms](https://www.mongodb.com/docs/atlas/atlas-search/highlighting.md)
Reference: [Return Stored Source Fields](https://www.mongodb.com/docs/atlas/atlas-search/return-stored-source.md)
Reference: [Query, Filter, and Retrieve Arrays of Objects](https://www.mongodb.com/docs/atlas/atlas-search/return-scope.md)
