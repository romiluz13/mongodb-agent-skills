---
title: numDimensions Must Match Embedding Model
impact: CRITICAL
impactDescription: Mismatched dimensions cause index failure or zero search results
tags: numDimensions, embedding-model, dimensions, vector-index
---

## numDimensions Must Match Embedding Model

The `numDimensions` in your index MUST exactly match the output dimensions of your embedding model. Mismatches cause silent failures.

**Maximum supported dimensions: 8192** (increased from 4096 in March 2025).

**Incorrect (wrong dimensions):**

```javascript
// WRONG: OpenAI text-embedding-3-small outputs 1536 dims
// but index specifies 768
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 768,  // WRONG! Model outputs 1536
    similarity: "cosine"
  }]
})
// Result: Documents won't be indexed, queries return nothing

// WRONG: Guessing dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 512,  // Guessing is dangerous
    similarity: "cosine"
  }]
})
```

**Correct (matching model dimensions):**

```javascript
// CORRECT: OpenAI text-embedding-3-small = 1536 dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
  }]
})

// CORRECT: OpenAI text-embedding-3-large = 3072 dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 3072,
    similarity: "cosine"
  }]
})

// CORRECT: Cohere embed-english-v3.0 = 1024 dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1024,
    similarity: "cosine"
  }]
})
```

**Common Embedding Model Dimensions:**

| Model | Dimensions |
|-------|------------|
| OpenAI text-embedding-3-small | 1536 |
| OpenAI text-embedding-3-large | 3072 |
| OpenAI text-embedding-ada-002 | 1536 |
| Cohere embed-english-v3.0 | 1024 |
| Cohere embed-multilingual-v3.0 | 1024 |
| Voyage voyage-3-large | 1024 |
| Voyage voyage-3.5 | 1024 |
| Google text-embedding-004 | 768 |
| HuggingFace all-MiniLM-L6-v2 | 384 |
| HuggingFace all-mpnet-base-v2 | 768 |

**How to Check Your Embedding Dimensions:**

```javascript
// Check actual vector length in your data
db.products.aggregate([
  { $match: { embedding: { $exists: true } } },
  { $limit: 1 },
  { $project: { dimensions: { $size: "$embedding" } } }
])
// Output: { dimensions: 1536 }

// Verify all vectors have consistent dimensions
db.products.aggregate([
  { $match: { embedding: { $exists: true } } },
  { $group: {
    _id: { $size: "$embedding" },
    count: { $sum: 1 }
  }}
])
// Should return single result if consistent
```

**Troubleshooting Zero Results:**

```javascript
// 1. Check if documents are being indexed
db.products.countDocuments({ embedding: { $exists: true, $type: "array" } })

// 2. Check vector length matches index
db.products.findOne({ embedding: { $exists: true } }, { "embedding": { $slice: 1 } })

// 3. Check index status
db.products.getSearchIndexes()
// Look for "status": "READY"
```

**When NOT to use this pattern:**

- Using variable-length sparse vectors (not supported)
- Changing embedding models (requires re-embedding all data)

Reference: [MongoDB Vector Index Definition](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-numDimensions)
