---
title: Use Same Embedding Model for Data and Query
impact: CRITICAL
impactDescription: Different models = zero or garbage results
tags: embedding-model, consistency, ingestion, query
---

## Use Same Embedding Model for Data and Query

The embedding model used for queries MUST be the same as the model used for document embeddings. Different models produce incompatible vector spaces.

**Incorrect (mismatched models):**

```javascript
// Data was embedded with OpenAI text-embedding-3-small
// db.products documents have embeddings from OpenAI

// WRONG: Query using different model (Cohere)
const queryEmbedding = await cohereClient.embed({
  texts: ["laptop for programming"],
  model: "embed-english-v3.0"  // WRONG MODEL!
})

db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",  // Contains OpenAI embeddings
      queryVector: queryEmbedding,  // Cohere embedding - INCOMPATIBLE!
      numCandidates: 200,
      limit: 10
    }
  }
])
// Result: Garbage results or no meaningful matches

// WRONG: Using different model version
// Data embedded with text-embedding-ada-002
const queryEmbedding = await openai.embeddings.create({
  input: "laptop for programming",
  model: "text-embedding-3-small"  // Different version!
})
// Result: Suboptimal results due to different vector spaces
```

**Correct (consistent model usage):**

```javascript
// Data embedded with OpenAI text-embedding-3-small
// Query with SAME model

// Ingestion (store with model info)
const docEmbedding = await openai.embeddings.create({
  input: document.content,
  model: "text-embedding-3-small"
})
await db.products.insertOne({
  content: document.content,
  embedding: docEmbedding.data[0].embedding,
  embeddingModel: "text-embedding-3-small"  // Track which model
})

// Query (use same model)
const queryEmbedding = await openai.embeddings.create({
  input: "laptop for programming",
  model: "text-embedding-3-small"  // SAME MODEL!
})

db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding.data[0].embedding,
      numCandidates: 200,
      limit: 10
    }
  }
])
// Result: Correct semantic matches
```

**Best Practice: Track Embedding Model:**

```javascript
// Store model information with documents
{
  _id: ObjectId("..."),
  content: "Product description...",
  embedding: [0.1, 0.2, ...],
  metadata: {
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    embeddedAt: ISODate("2024-01-15")
  }
}

// Check model consistency before querying
const sampleDoc = await db.products.findOne(
  { embedding: { $exists: true } },
  { "metadata.embeddingModel": 1 }
)
console.log("Collection uses:", sampleDoc.metadata.embeddingModel)
// Ensure query uses same model
```

**Re-embedding When Changing Models:**

```javascript
// If upgrading models, re-embed ALL documents
async function reEmbedCollection(newModel) {
  const cursor = db.products.find({ content: { $exists: true } })

  for await (const doc of cursor) {
    const newEmbedding = await openai.embeddings.create({
      input: doc.content,
      model: newModel
    })

    await db.products.updateOne(
      { _id: doc._id },
      {
        $set: {
          embedding: newEmbedding.data[0].embedding,
          "metadata.embeddingModel": newModel,
          "metadata.embeddedAt": new Date()
        }
      }
    )
  }

  // Update index if dimensions changed
  // (text-embedding-3-large = 3072, text-embedding-3-small = 1536)
}
```

**Debugging Zero Results:**

```javascript
// Step 1: Check if documents have embeddings
db.products.countDocuments({ embedding: { $exists: true } })

// Step 2: Check embedding dimensions
db.products.aggregate([
  { $match: { embedding: { $exists: true } } },
  { $limit: 1 },
  { $project: { dims: { $size: "$embedding" } } }
])

// Step 3: Verify query embedding dimensions match
console.log("Query dims:", queryEmbedding.length)
// Must match document embedding dimensions

// Step 4: Check model metadata
db.products.findOne({}, { "metadata.embeddingModel": 1 })
```

**When NOT to use this pattern:**

- Using MongoDB's Automated Embedding feature (model handled automatically)
- Multi-model hybrid systems (requires separate indexes)
- Dimensionality reduction (requires careful handling)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB Vector Search Troubleshooting](https://mongodb.com/docs/atlas/atlas-vector-search/troubleshooting/)
