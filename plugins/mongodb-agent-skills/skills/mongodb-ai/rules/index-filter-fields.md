---
title: Index Filter Fields for Pre-Filtering
impact: CRITICAL
impactDescription: Missing filter indexes cause query errors or force inefficient post-filtering
tags: filter, pre-filter, vector-index, type-filter
---

## Index Filter Fields for Pre-Filtering

To pre-filter vector search results, fields must be indexed with `type: "filter"`. Using unindexed fields in filters causes errors.

**Incorrect (filtering on unindexed field):**

```javascript
// Index WITHOUT filter field
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
  // Missing filter field definition!
})

// Query with filter - FAILS!
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: { category: "electronics" }  // Error: 'category' not indexed
    }
  }
])
// Error: Path 'category' must be indexed as type "filter"
```

**Correct (filter fields indexed):**

```javascript
// Index WITH filter fields
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    {
      type: "filter",
      path: "category"
    },
    {
      type: "filter",
      path: "status"
    },
    {
      type: "filter",
      path: "price"
    }
  ]
})

// Query with filter - WORKS!
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: {
        $and: [
          { category: "electronics" },
          { status: "active" },
          { price: { $gte: 100, $lte: 500 } }
        ]
      }
    }
  }
])
```

**Supported Filter Field Types:**

| Type | Example |
|------|---------|
| `boolean` | `{ inStock: true }` |
| `date` | `{ createdAt: { $gte: ISODate("2024-01-01") } }` |
| `number` | `{ price: { $lte: 100 } }` |
| `objectId` | `{ userId: ObjectId("...") }` |
| `string` | `{ category: "tech" }` |
| `UUID` | `{ sessionId: UUID("...") }` |
| Arrays of supported scalar types | `{ genres: "Action" }` |

**Supported Filter Operators:**

```javascript
// Comparison
{ price: { $lt: 100 } }
{ price: { $lte: 100 } }
{ price: { $eq: 100 } }
{ price: { $ne: 100 } }
{ price: { $gte: 100 } }
{ price: { $gt: 100 } }

// Array
{ tags: { $in: ["sale", "new"] } }
{ tags: { $nin: ["discontinued"] } }

// Existence
{ discount: { $exists: true } }

// Logical
{ $and: [{ status: "active" }, { price: { $lt: 100 } }] }
{ $or: [{ category: "A" }, { category: "B" }] }
{ status: { $not: { $eq: "archived" } } }
{ $nor: [{ category: "A" }, { category: "B" }] }
```

**Array Equality vs `$in`:**

```javascript
// Direct equality on array fields is supported (containment-style match)
{ genres: "Action" }

// Use $in when matching any of multiple values
{ genres: { $in: ["Action", "Comedy"] } }
```

**How to Verify:**

```javascript
// Check which fields are indexed for filtering
db.products.getSearchIndexes().forEach(idx => {
  print(idx.name, JSON.stringify(idx.latestDefinition.fields, null, 2))
})
```

**When NOT to use this pattern:**

- Need analyzed-text prefilters like fuzzy, phrase, wildcard, or geo operators (use `$search.vectorSearch`)
- Filtering on nested object values that are not indexed as `type: "filter"`
- Text search filtering (use $search in hybrid search instead)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Search Pre-Filtering](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-filter)
