---
title: Automated Embedding Generation
impact: MEDIUM
impactDescription: Server-side embedding eliminates client-side embedding code
tags: automated-embedding, voyage-ai, text-type, server-side
---

## Automated Embedding Generation

MongoDB can automatically generate embeddings server-side. Eliminates need for client-side embedding code.

**Incorrect (manual embedding only):**

```javascript
// WRONG: Always embedding client-side
// Requires embedding API integration in every application
const embedding = await openai.embeddings.create({
  input: document.content,
  model: "text-embedding-3-small"
})

await db.products.insertOne({
  content: document.content,
  embedding: embedding.data[0].embedding  // Manual embedding
})
```

**Correct (automated embedding with text type):**

```javascript
// Create index with automated embedding
db.products.createSearchIndex("auto_embed_index", "vectorSearch", {
  fields: [{
    type: "text",              // Use "text" instead of "vector"
    path: "content",           // Field containing text to embed
    model: "voyage-3-large"    // Embedding model
  }]
})

// Insert documents - NO embedding code needed!
await db.products.insertOne({
  content: "High-performance laptop for developers",
  category: "electronics"
  // No embedding field - MongoDB generates it automatically
})

// Query with text string - NO embedding code needed!
db.products.aggregate([
  {
    $vectorSearch: {
      index: "auto_embed_index",
      path: "content",
      query: "laptop for programming",  // Text string, not vector!
      numCandidates: 100,
      limit: 10
    }
  }
])
```

**Supported Embedding Models:**

| Model | Dimensions | Best For |
|-------|------------|----------|
| `voyage-3-large` | 1024 | Highest quality retrieval |
| `voyage-3.5` | 1024 | Balanced multilingual |
| `voyage-3.5-lite` | 1024 | Low latency, lower cost |

**Requirements:**

- M10+ cluster tier (not available on M0/M2/M5)
- Data processed through GCP
- Private Preview feature (check availability)

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

**Combining with Pre-Filtering:**

```javascript
// Index with automated embedding AND filter fields
db.products.createSearchIndex("auto_embed_index", "vectorSearch", {
  fields: [
    {
      type: "text",
      path: "content",
      model: "voyage-3-large"
    },
    {
      type: "filter",
      path: "category"
    }
  ]
})

// Query with filter
db.products.aggregate([
  {
    $vectorSearch: {
      index: "auto_embed_index",
      path: "content",
      query: "laptop for programming",
      filter: { category: "electronics" },
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
| Model flexibility | Any model | Voyage AI only |
| Cost control | Client-side | Server-side billing |
| Latency | Extra API call | Async on write |
| Vector access | Stored in document | Internal only |

**BinData Vector Ingestion (Pre-Quantized):**

```javascript
// If you have pre-quantized vectors from embedding model
// Store as BinData for 66% disk storage reduction

// Insert with BinData
await db.products.insertOne({
  content: "Product description",
  embedding: new BinData(9, base64EncodedFloat32Vector)
})

// BinData subtypes:
// - BinData(9, ...) - float32
// - BinData(10, ...) - int8 (scalar quantized)
// - BinData(11, ...) - packed bit (binary quantized)
```

**When NOT to use this pattern:**

- Need embeddings stored in document for other uses
- Using embedding model not supported (OpenAI, Cohere, etc.)
- M0/M2/M5 clusters (not supported)
- Data cannot be processed through GCP

Reference: [MongoDB Automated Embedding](https://mongodb.com/docs/atlas/atlas-vector-search/automated-embedding/)
