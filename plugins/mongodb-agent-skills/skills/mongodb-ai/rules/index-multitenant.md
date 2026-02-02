---
title: Multi-Tenant Vector Search Architecture
impact: HIGH
impactDescription: Proper multi-tenant design ensures security, performance, and scalability
tags: multi-tenant, tenant_id, SaaS, architecture, isolation
---

## Multi-Tenant Vector Search Architecture

Store all tenants in a single collection with `tenant_id` field for pre-filtering. This is MongoDB's recommended pattern for multi-tenant vector search.

**Incorrect (separate collections per tenant):**

```javascript
// WRONG: One collection per tenant
// Creates operational complexity, performance issues
db.tenant_acme_products.createSearchIndex("vector_index", "vectorSearch", {...})
db.tenant_globex_products.createSearchIndex("vector_index", "vectorSearch", {...})
db.tenant_initech_products.createSearchIndex("vector_index", "vectorSearch", {...})
// Result: Change stream overhead, index management nightmare
```

**Correct (single collection, tenant_id filter):**

```javascript
// CORRECT: Single collection with tenant_id field
// Document schema
{
  _id: ObjectId("..."),
  tenant_id: "tenant_acme",       // Tenant identifier
  content: "Product description",
  embedding: [...],
  metadata: { category: "..." }
}

// Vector index with tenant_id as filter
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
      path: "tenant_id"         // CRITICAL: Index for filtering
    }
  ]
})

// Query with tenant isolation
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10,
      filter: { tenant_id: currentTenantId }  // Guaranteed isolation
    }
  }
])
```

**Benefits of Single Collection:**

| Aspect | Single Collection | Per-Tenant Collections |
|--------|------------------|------------------------|
| Management | Simple | Complex |
| Performance | Optimized | Change stream overhead |
| Scaling | Easy | Manual per tenant |
| Isolation | Pre-filter guaranteed | N/A |
| Index count | 1 | N (one per tenant) |

**Handling Large Tenants (Views Pattern):**

```javascript
// For large tenants (top 1%), create dedicated views
// Step 1: Create view for large tenant
db.createView(
  "products_tenant_large",
  "products",
  [{ $match: { tenant_id: "large_tenant_id" } }]
)

// Step 2: Create dedicated index on view
db.products_tenant_large.createSearchIndex(
  "vector_index_large",
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

// Step 3: Create view for all small tenants
db.createView(
  "products_small_tenants",
  "products",
  [{ $match: { tenant_id: { $nin: ["large_tenant_id"] } } }]
)
```

**Sharding for Many Large Tenants:**

```javascript
// Use tenant_id as shard key for horizontal scaling
sh.shardCollection("mydb.products", { tenant_id: 1 })

// Each tenant's data will be colocated on specific shards
// Enables efficient tenant-specific queries
```

**Query Routing Pattern:**

```javascript
async function vectorSearchForTenant(query, tenantId) {
  const isLargeTenant = await isLargeTenant(tenantId)

  if (isLargeTenant) {
    // Use dedicated view/index for large tenants
    return db.products_tenant_large.aggregate([
      {
        $vectorSearch: {
          index: "vector_index_large",
          path: "embedding",
          queryVector: await embed(query),
          numCandidates: 200,
          limit: 10
        }
      }
    ]).toArray()
  } else {
    // Use main collection with filter for small tenants
    return db.products.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: await embed(query),
          numCandidates: 200,
          limit: 10,
          filter: { tenant_id: tenantId }
        }
      }
    ]).toArray()
  }
}
```

**When NOT to use this pattern:**

- Tenants cannot share same VPC (requires separate projects)
- Regulatory requirements mandate physical data separation
- Legacy systems requiring separate collections

Reference: [MongoDB Multi-Tenant Architecture](https://mongodb.com/docs/atlas/atlas-vector-search/multi-tenant-architecture/)
