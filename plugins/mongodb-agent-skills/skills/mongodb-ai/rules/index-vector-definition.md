---
title: Vector Index Definition Requirements
impact: CRITICAL
impactDescription: Missing or incorrect fields cause index creation failure or zero search results
tags: vector-index, create-index, numDimensions, similarity, type
---

## Vector Index Definition Requirements

A vector index requires four mandatory fields: `type`, `path`, `numDimensions`, and `similarity`. Missing any field or using incorrect values causes index creation failure or broken search.

**Incorrect (missing required fields):**

```javascript
// WRONG: This will fail - missing type, numDimensions, similarity
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{ path: "embedding" }]
})

// WRONG: Using incorrect type value
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "text",  // Wrong! Must be "vector"
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})
```

**Correct (all required fields specified):**

```javascript
// CORRECT: All required fields present
db.products.createSearchIndex(
  "vector_index",
  "vectorSearch",
  {
    fields: [
      {
        type: "vector",           // Required: must be "vector"
        path: "embedding",        // Required: field containing embeddings
        numDimensions: 1536,      // Required: must match embedding model
        similarity: "cosine"      // Required: "cosine"|"euclidean"|"dotProduct"
      }
    ]
  }
)
```

**Complete Index with Filter Fields:**

```javascript
db.products.createSearchIndex(
  "vector_index",
  "vectorSearch",
  {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: 1536,
        similarity: "cosine"
      },
      {
        type: "filter",           // For pre-filtering
        path: "category"
      },
      {
        type: "filter",
        path: "status"
      }
    ]
  }
)
```

**How to Verify:**

```javascript
// Check existing vector indexes
db.products.getSearchIndexes()

// Via MCP:
// mcp__mongodb__collection-indexes({ database: "mydb", collection: "products" })
```

**When NOT to use this pattern:**

- Using Automated Embedding feature (use `type: "text"` instead)
- Creating traditional search indexes (use Atlas Search)

Reference: [MongoDB Vector Search Index Definition](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)
