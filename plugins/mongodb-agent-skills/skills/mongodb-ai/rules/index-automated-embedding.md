---
title: Automated Embedding Generation
impact: MEDIUM
impactDescription: Server-side embedding can eliminate client-side pipelines, but syntax and availability are deployment-specific
tags: automated-embedding, autoEmbed, vectorSearch, voyage, preview, self-managed, atlas
---

## Automated Embedding Generation

MongoDB automated embedding now has deployment-specific behavior. Use the syntax that matches your deployment:

- **Self-managed MongoDB Community Edition 8.2+ with Search/Vector Search (`mongot`)**: Preview feature that uses `autoEmbed`.
- **Atlas**: separate Private Preview track with different setup and syntax expectations.

Using the wrong syntax for the wrong deployment type causes failures or incorrect assumptions.

**Incorrect (using older/private-preview syntax for Community 8.2+):**

```javascript
// WRONG for self-managed Community 8.2+ auto-embedding path
db.listingsAndReviews.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "text",
    path: "summary",
    model: "voyage-3-large"
  }]
})
```

**Correct (Community 8.2+ Preview with `autoEmbed`):**

```javascript
// Index definition for Community 8.2+ preview
db.listingsAndReviews.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    {
      type: "autoEmbed",
      modality: "text",
      path: "summary",
      model: "voyage-4"
    },
    { type: "filter", path: "address.country" },
    { type: "filter", path: "bedrooms" }
  ]
})

// Query with text input (MongoDB generates query embedding)
db.listingsAndReviews.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "summary",
      filter: {
        bedrooms: { $gte: 3 },
        "address.country": { $in: ["United States"] }
      },
      query: { text: "close to amusement parks" },
      model: "voyage-4",
      numCandidates: 100,
      limit: 10
    }
  }
])
```

**Community 8.2+ Supported Models (`autoEmbed`):**

| Model | Dimensions | Best For |
|-------|------------|----------|
| `voyage-4-lite` | provider-defined | High-volume, cost-sensitive workloads |
| `voyage-4` | provider-defined | General semantic search (recommended baseline) |
| `voyage-4-large` | provider-defined | Maximum semantic accuracy |
| `voyage-code-3` | provider-defined | Code and technical-document retrieval |

**Requirements:**

- **Community 8.2+ preview path**:
  - Self-managed MongoDB Community Edition 8.2+ with Search/Vector Search (`mongot`)
  - Voyage API key(s) configured for indexing/query
  - Preview feature: validate behavior per release before production use
- **Atlas private preview path**:
  - M10+ cluster
  - private-preview enrollment and constraints apply
  - inference service currently runs on GCP even if your cluster is on another provider

**When Automated Embedding is Triggered:**

```javascript
// 1. On document INSERT - embedding auto-generated
await db.products.insertOne({
  content: "New product description"
})

// 2. On document UPDATE - embedding auto-regenerated
await db.products.updateOne(
  { _id: productId },
  { $set: { content: "Updated product description" } }
)

// 3. On bulk INSERT/UPDATE - batch embedding
await db.products.insertMany(documents)
```

**Deployment-Specific Notes:**

1. Community 8.2+ preview guidance uses `autoEmbed` (with `modality` + model) in index definitions.
2. Atlas private preview guidance has separate docs and can differ in exact syntax and supported model list.
3. Keep deployment assumptions explicit in playbooks; do not mix syntax from one track into the other.

**Combining Automated Embedding with Pre-Filtering:**

```javascript
db.listingsAndReviews.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    {
      type: "autoEmbed",
      modality: "text",
      path: "summary",
      model: "voyage-4"
    },
    {
      type: "filter",
      path: "address.country"
    }
  ]
})

db.listingsAndReviews.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "summary",
      query: { text: "family-friendly home near parks" },
      model: "voyage-4",
      filter: { "address.country": "United States" },
      numCandidates: 100,
      limit: 10
    }
  }
])
```

**Manual vs Automated Comparison:**

| Aspect | Manual Embedding | Automated Embedding |
|--------|-----------------|---------------------|
| Client code | Required | Not needed |
| Model flexibility | Any model you integrate | Managed Voyage-model set |
| Cost control | Client-side | Server-side billing |
| Query input | Precomputed vectors | Natural-language text query support |
| Availability | GA patterns | Preview-gated, deployment-specific |

**When NOT to use this pattern:**

- You need full control over embedding provider/model lifecycle
- You must reuse raw embedding vectors outside MongoDB workflows
- Your compliance or platform constraints don't match preview/deployment requirements
- You are on Atlas without private-preview enrollment for automated embedding features

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Auto-Generated Embeddings](https://mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic/)
