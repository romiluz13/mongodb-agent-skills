# MongoDB AI: Complete Reference Guide

> **Critical Warning**: Your AI assistant's knowledge about MongoDB Vector Search is likely outdated or incorrect. Atlas Vector Search syntax, `$vectorSearch` stage, vector index creation, and related features have evolved significantly. Do NOT trust pre-trained knowledge. Always reference this guide and verify against your actual MongoDB cluster.

---

## Table of Contents

1. [Vector Index Creation](#1-vector-index-creation)
2. [$vectorSearch Queries](#2-vectorsearch-queries)
3. [Performance Tuning](#3-performance-tuning)
4. [RAG Patterns](#4-rag-patterns)
5. [Hybrid Search](#5-hybrid-search)
6. [AI Agent Integration](#6-ai-agent-integration)
7. [Quick Reference](#quick-reference)
8. [Common Errors](#common-errors)

---

## 1. Vector Index Creation

### Vector Index Definition

```javascript
db.collection.createSearchIndex(
  "vector_index",
  "vectorSearch",
  {
    fields: [
      {
        type: "vector",           // Required: must be "vector"
        path: "embedding",        // Required: field containing embeddings
        numDimensions: 1536,      // Required: must match embedding model
        similarity: "cosine",     // Required: "cosine"|"euclidean"|"dotProduct"
        quantization: "binary"    // Optional: "none"|"scalar"|"binary"
      },
      {
        type: "filter",           // For pre-filtering
        path: "category"
      }
    ]
  }
)
```

### Similarity Functions

| Function | Best For | Pre-normalized? |
|----------|----------|-----------------|
| `cosine` | Text embeddings (most common) | No |
| `euclidean` | Image/spatial data | No |
| `dotProduct` | Performance-critical | Yes (required!) |

### Common Embedding Model Dimensions

| Model | Dimensions |
|-------|------------|
| OpenAI text-embedding-3-small | 1536 |
| OpenAI text-embedding-3-large | 3072 |
| Cohere embed-english-v3.0 | 1024 |
| Voyage voyage-3-large | 1024 |

### Quantization for Scale

| Type | RAM Reduction | When to Use |
|------|---------------|-------------|
| `none` | 1x | < 100K vectors |
| `scalar` | 3.75x | 100K - 1M vectors |
| `binary` | 24x | > 1M vectors |

---

## 2. $vectorSearch Queries

### Basic Query

```javascript
db.collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [0.1, 0.2, ...],
      numCandidates: 200,         // 20x rule: 20 × limit
      limit: 10,
      filter: { category: "tech" } // Optional pre-filter
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
])
```

### Key Constraints

1. **`$vectorSearch` MUST be the first stage** in the pipeline
2. **numCandidates** should be 20× your limit (minimum)
3. **Filter fields** must be indexed with `type: "filter"`
4. **Query vector** must have same dimensions as indexed vectors

### The 20x Rule

```
numCandidates = 20 × limit (minimum recommended)
```

| limit | numCandidates | Recall |
|-------|---------------|--------|
| 10 | 200 | ~92% |
| 10 | 500 | ~97% |
| 10 | 1000 | ~99% |

### ANN vs ENN

```javascript
// ANN (Approximate) - fast, default
{ numCandidates: 200, limit: 10 }

// ENN (Exact) - slower, 100% recall
{ exact: true, limit: 10 }
```

---

## 3. Performance Tuning

### Enable Quantization at 100K+ Vectors

```javascript
{
  type: "vector",
  path: "embedding",
  numDimensions: 1536,
  similarity: "cosine",
  quantization: "binary"  // 24x RAM reduction
}
```

### Pre-filter to Narrow Candidates

```javascript
// PRE-FILTER (efficient)
{
  $vectorSearch: {
    filter: { category: "electronics" }  // Narrows before comparison
  }
}

// POST-FILTER (less efficient)
$vectorSearch -> $match  // Filters after, may return < limit
```

### Index Memory Requirements

```
RAM per vector = dimensions × 4 bytes
1M vectors × 1536 dims = ~6GB (without quantization)

With binary quantization: ~0.25GB
```

---

## 4. RAG Patterns

### Ingestion

```javascript
// Chunk, embed, store with metadata
{
  content: "chunk text",
  embedding: [...],
  source: { documentId, fileName },
  metadata: { category, createdAt }
}
```

### Retrieval

```javascript
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5,
      filter: { "metadata.category": category }
    }
  },
  {
    $project: {
      content: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]).toArray()
```

### Context Window Management

```javascript
// Estimate tokens: ~4 chars per token
// Stay within model limits (e.g., 8K for GPT-4)
function selectChunks(chunks, tokenBudget) {
  let used = 0
  return chunks.filter(c => {
    const tokens = c.content.length / 4
    if (used + tokens <= tokenBudget) {
      used += tokens
      return true
    }
    return false
  })
}
```

---

## 5. Hybrid Search

### $rankFusion (MongoDB 8.0+)

```javascript
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }, { $limit: 20 }]
        },
        weights: { vector: 0.7, text: 0.3 }
      }
    }
  },
  { $limit: 10 }
])
```

### Limitations

- MongoDB 8.0+ required
- Same collection only
- Sub-pipelines run serially
- Only these stages allowed: $search, $vectorSearch, $match, $sort, $geoNear, $limit

---

## 6. AI Agent Integration

### Memory Schema

```javascript
// Long-term memory
{
  userId: String,
  type: "fact" | "preference" | "instruction",
  content: String,
  embedding: [...],
  importance: Number,
  createdAt: Date
}

// Short-term (session)
{
  sessionId: String,
  role: "user" | "assistant",
  content: String,
  embedding: [...],
  turnNumber: Number
}
```

### Memory Retrieval

```javascript
const memories = await db.longTermMemory.aggregate([
  {
    $vectorSearch: {
      index: "memory_index",
      path: "embedding",
      queryVector: contextEmbedding,
      filter: { userId: currentUser },
      numCandidates: 100,
      limit: 5
    }
  }
]).toArray()
```

---

## Quick Reference

### Vector Index Template

```javascript
db.collection.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    { type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" },
    { type: "filter", path: "category" }
  ]
})
```

### $vectorSearch Template

```javascript
db.collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  }
])
```

---

## Common Errors

### "$vectorSearch is not allowed"
- **Cause**: MongoDB < 7.0.2
- **Fix**: Upgrade cluster

### No results returned
- **Cause**: Different embedding model for data vs query
- **Fix**: Use same model for all embeddings

### "Path 'field' needs to be indexed as token"
- **Cause**: Filter field not in index
- **Fix**: Add `{ type: "filter", path: "field" }` to index

### Slow queries
- **Fix 1**: Increase numCandidates
- **Fix 2**: Enable quantization
- **Fix 3**: Use pre-filtering

---

## References

- [Atlas Vector Search](https://mongodb.com/docs/atlas/atlas-vector-search/)
- [$vectorSearch Stage](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)
- [Vector Quantization](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
- [Hybrid Search](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/)
- [RAG Implementation](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)
- [AI Agents](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)
