---
title: Partial Indexing with Views
impact: MEDIUM
impactDescription: Index only relevant documents, reduce index size and improve performance
tags: views, partial-index, filter, subset
---

## Partial Indexing with Views

Create vector indexes on Views to index only a subset of documents. Reduces index size and improves performance.

**Incorrect (indexing all documents):**

```javascript
// WRONG: Index includes documents without embeddings
// or inactive/archived documents
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})
// Result: Index includes null embeddings, wastes resources
```

**Correct (partial indexing via Views):**

```javascript
// Step 1: Create View filtering to documents with embeddings
db.createView(
  "products_with_embeddings",  // View name
  "products",                   // Source collection
  [
    {
      $match: {
        embedding: { $exists: true, $type: "array" },
        status: "active"
      }
    }
  ]
)

// Step 2: Create vector index on the View
db.products_with_embeddings.createSearchIndex(
  "vector_index",
  "vectorSearch",
  {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    }]
  }
)

// Step 3: Query the View
db.products_with_embeddings.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10
    }
  }
])
```

**Common View Patterns:**

```javascript
// 1. Filter by existence of embedding field
db.createView("docs_with_vectors", "documents", [
  { $match: { embedding: { $exists: true } } }
])

// 2. Filter by status (only active documents)
db.createView("active_products", "products", [
  { $match: { status: "active", deletedAt: null } }
])

// 3. Filter by date range (recent documents only)
db.createView("recent_articles", "articles", [
  {
    $match: {
      createdAt: {
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)  // Last 90 days
      }
    }
  }
])

// 4. Filter by category (domain-specific index)
db.createView("tech_products", "products", [
  { $match: { category: { $in: ["electronics", "computers", "software"] } } }
])

// 5. Exclude test/sample data
db.createView("production_data", "documents", [
  { $match: { isTest: { $ne: true } } }
])
```

**Multi-Tenant with Views:**

```javascript
// Create view per large tenant
db.createView(
  "products_tenant_acme",
  "products",
  [{ $match: { tenant_id: "acme_corp" } }]
)

// Create index on tenant-specific view
db.products_tenant_acme.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})

// Query tenant's view directly (no filter needed)
db.products_tenant_acme.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10
    }
  }
])
```

**Performance Considerations:**

| Aspect | Full Index | Partial Index (View) |
|--------|-----------|---------------------|
| Index size | Larger | Smaller |
| Build time | Longer | Shorter |
| Query scope | All docs | Filtered subset |
| Maintenance | One index | Multiple if needed |

**How Views Work with Indexes:**

```
Source Collection (products)
    │
    ├── View: products_with_embeddings
    │       └── Vector Index: vector_index_active
    │
    └── View: archived_products
            └── Vector Index: vector_index_archived
```

**Allowed Stages in View Definition:**

| Stage | Support |
|-------|---------|
| `$match` | Always supported |
| `$addFields` | MongoDB 8.1+ |
| `$set` | MongoDB 8.1+ |
| `$match` with `$expr` | MongoDB 8.1+ |

**Important Notes:**

1. Index uses View name, not source collection name
2. Views must be on same database as source collection
3. On MongoDB 8.0, run `$vectorSearch` against the source collection using the View-backed index
4. On MongoDB 8.1+, you can run `$vectorSearch` directly against the View
5. View definition cannot include `$vectorSearch` stage itself
6. MongoDB 8.1+ adds `createSearchIndex()` / `updateSearchIndex()` / `dropSearchIndex()` / `$listSearchIndexes` support on Views in mongosh and drivers

**When NOT to use this pattern:**

- Need to search all documents regardless of status
- View filter is too restrictive (returns very few documents)
- MongoDB version < 8.0 (feature unavailable)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Views with Vector Search](https://mongodb.com/docs/atlas/atlas-vector-search/view-support/)
