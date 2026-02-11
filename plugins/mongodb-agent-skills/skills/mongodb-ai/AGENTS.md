# MongoDB AI & Vector Search Best Practices

**Version 1.4.0**
MongoDB
February 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or reviewing MongoDB schemas, queries, AI/search workflows, and transaction consistency patterns. Humans may also
> find it useful, but guidance here is optimized for automation and
> consistency by AI-assisted workflows.

---

## Abstract

MongoDB Atlas Vector Search and AI integration patterns for AI agents and developers. Contains 33 rules across 6 categories: Vector Index Creation (CRITICAL - vector field definition, similarity functions, filter fields, quantization, dimension matching, multi-tenant architecture, Views for partial indexing, HNSW options, automated embedding), $vectorSearch Queries (CRITICAL - first-stage requirement, numCandidates tuning, ANN vs ENN search, pre-filtering with $exists/$ne/$not, lexical prefilters via $search.vectorSearch for fuzzy/phrase/geo, score retrieval, embedding model consistency), Performance Tuning (HIGH - quantization at scale, index memory requirements, numCandidates trade-offs, pre-filter optimization, explain for vector search, dedicated Search Nodes), RAG Patterns (HIGH - ingestion patterns, retrieval patterns, context window management, metadata filtering), Hybrid Search (MEDIUM - $rankFusion usage, $scoreFusion for score-based combination, weight tuning, sub-pipeline limitations), AI Agent Integration (MEDIUM - memory schema design, semantic memory retrieval, session context storage). Each rule includes incorrect/correct code examples with quantified impact metrics, 'When NOT to use' exceptions, and verification commands. This skill bridges the critical knowledge gap where AI assistants have outdated information about MongoDB Vector Search features.

---

## Table of Contents

1. [Vector Index Creation](#1-vector-index-creation) — **CRITICAL**
   - 1.1 [Automated Embedding Generation](#11-automated-embedding-generation)
   - 1.2 [Choosing the Right Similarity Function](#12-choosing-the-right-similarity-function)
   - 1.3 [HNSW Index Options Tuning](#13-hnsw-index-options-tuning)
   - 1.4 [Index Filter Fields for Pre-Filtering](#14-index-filter-fields-for-pre-filtering)
   - 1.5 [Multi-Tenant Vector Search Architecture](#15-multi-tenant-vector-search-architecture)
   - 1.6 [numDimensions Must Match Embedding Model](#16-numdimensions-must-match-embedding-model)
   - 1.7 [Partial Indexing with Views](#17-partial-indexing-with-views)
   - 1.8 [Vector Index Definition Requirements](#18-vector-index-definition-requirements)
   - 1.9 [Vector Quantization for Scale](#19-vector-quantization-for-scale)
2. [$vectorSearch Queries](#2-$vectorsearch-queries) — **CRITICAL**
   - 2.1 [$vectorSearch Must Be First Pipeline Stage](#21-vectorsearch-must-be-first-pipeline-stage)
   - 2.2 [ANN vs ENN Search](#22-ann-vs-enn-search)
   - 2.3 [Lexical Prefilters for Vector Search](#23-lexical-prefilters-for-vector-search)
   - 2.4 [numCandidates Tuning (The 20x Rule)](#24-numcandidates-tuning-the-20x-rule)
   - 2.5 [Pre-Filtering Vector Search](#25-pre-filtering-vector-search)
   - 2.6 [Retrieving Vector Search Scores](#26-retrieving-vector-search-scores)
   - 2.7 [Use Same Embedding Model for Data and Query](#27-use-same-embedding-model-for-data-and-query)
3. [Performance Tuning](#3-performance-tuning) — **HIGH**
   - 3.1 [Dedicated Search Nodes for Production](#31-dedicated-search-nodes-for-production)
   - 3.2 [Enable Quantization at Scale](#32-enable-quantization-at-scale)
   - 3.3 [Explain Vector Search Queries](#33-explain-vector-search-queries)
   - 3.4 [numCandidates Trade-offs](#34-numcandidates-trade-offs)
   - 3.5 [Pre-filter to Narrow Candidate Set](#35-pre-filter-to-narrow-candidate-set)
   - 3.6 [Vector Index Must Fit in RAM](#36-vector-index-must-fit-in-ram)
4. [RAG Patterns](#4-rag-patterns) — **HIGH**
   - 4.1 [Managing LLM Context Window Limits](#41-managing-llm-context-window-limits)
   - 4.2 [RAG Ingestion Pattern](#42-rag-ingestion-pattern)
   - 4.3 [RAG Metadata Filtering](#43-rag-metadata-filtering)
   - 4.4 [RAG Retrieval Pattern](#44-rag-retrieval-pattern)
5. [Hybrid Search](#5-hybrid-search) — **MEDIUM**
   - 5.1 [Hybrid Search Limitations](#51-hybrid-search-limitations)
   - 5.2 [Rank-Based Hybrid Search with $rankFusion](#52-rank-based-hybrid-search-with-rankfusion)
   - 5.3 [Score-Based Hybrid Search with $scoreFusion](#53-score-based-hybrid-search-with-scorefusion)
   - 5.4 [Tuning Hybrid Search Weights](#54-tuning-hybrid-search-weights)
6. [AI Agent Integration](#6-ai-agent-integration) — **MEDIUM**
   - 6.1 [AI Agent Memory Schema Design](#61-ai-agent-memory-schema-design)
   - 6.2 [Semantic Memory Retrieval](#62-semantic-memory-retrieval)
   - 6.3 [Session Context Storage](#63-session-context-storage)

---

## 1. Vector Index Creation

**Impact: CRITICAL**

Vector indexes are fundamentally different from traditional MongoDB indexes. They require specific parameters that AI assistants often get wrong due to knowledge cutoffs. The index definition must include: `type: "vector"`, `path` to the embedding field, `numDimensions` that EXACTLY matches your embedding model output (e.g., 1536 for OpenAI text-embedding-3-small), and `similarity` function (cosine, euclidean, or dotProduct). Getting numDimensions wrong results in indexing failures. Choosing the wrong similarity function produces incorrect rankings. Filter fields require separate `type: "filter"` definitions. Quantization (scalar or binary) can reduce RAM by 3.75x to 24x but requires understanding the trade-offs. Multi-tenant architectures should use a single collection with `tenant_id` pre-filtering. Views enable partial indexing for specific document subsets. HNSW parameters (maxEdges, numEdgeCandidates) can be tuned for specific workloads. Automated embedding eliminates client-side embedding code. These are the foundational decisions that determine whether vector search works at all.

### 1.1 Automated Embedding Generation

**Impact: MEDIUM (Server-side embedding can eliminate client-side pipelines, but syntax and availability are deployment-specific)**

MongoDB automated embedding now has deployment-specific behavior. Use the syntax that matches your deployment:

- **Self-managed MongoDB Community Edition 8.2+ with Search/Vector Search (`mongot`)**: Preview feature that uses `autoEmbed`.

- **Atlas**: separate Private Preview track with different setup and syntax expectations.

Using the wrong syntax for the wrong deployment type causes failures or incorrect assumptions.

**Incorrect: using older/private-preview syntax for Community 8.2+**

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

**Correct: Community 8.2+ Preview with `autoEmbed`**

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

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic/](https://mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic/)

### 1.2 Choosing the Right Similarity Function

**Impact: CRITICAL (Wrong similarity function returns incorrect rankings and irrelevant results)**

The similarity function determines how vector distances are calculated. Choosing wrong produces incorrect result rankings.

**Incorrect: mismatched similarity function**

```javascript
// WRONG: Using dotProduct with non-normalized vectors
// dotProduct requires pre-normalized vectors (magnitude = 1)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "dotProduct"  // Incorrect if vectors aren't normalized!
  }]
})

// WRONG: Using euclidean for text embeddings
// Most text embedding models are designed for cosine similarity
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "euclidean"  // Works but suboptimal for text
  }]
})
```

**Correct: matching similarity to use case**

```javascript
// CORRECT: cosine for text embeddings (most common)
// Works with OpenAI, Cohere, Voyage AI, etc.
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"  // Normalizes automatically
  }]
})

// CORRECT: euclidean for image/spatial embeddings
// When absolute distance matters
db.images.createSearchIndex("image_vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 512,
    similarity: "euclidean"
  }]
})

// CORRECT: dotProduct when vectors are pre-normalized
// AND you want maximum performance
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "normalized_embedding",  // Must be normalized!
    numDimensions: 1536,
    similarity: "dotProduct"
  }]
})
```

**Similarity Function Guide:**

| Function | Best For | Pre-normalized? | Notes |

|----------|----------|-----------------|-------|

| `cosine` | Text embeddings | No (auto-normalizes) | Most common choice |

| `euclidean` | Image/spatial data | No | Distance-based |

| `dotProduct` | Performance-critical | Yes (required!) | Fastest computation |

**How to Check Your Embedding Model:**

```javascript
// Check if your vectors are normalized (magnitude ≈ 1)
db.products.aggregate([
  { $limit: 1 },
  { $project: {
    magnitude: {
      $sqrt: {
        $reduce: {
          input: "$embedding",
          initialValue: 0,
          in: { $add: ["$$value", { $multiply: ["$$this", "$$this"] }] }
        }
      }
    }
  }}
])
// If magnitude ≈ 1.0, vectors are normalized
// If magnitude varies (e.g., 0.5-2.0), use cosine
```

**When NOT to use this pattern:**

- `dotProduct` with non-normalized vectors (results will be wrong)

- Changing similarity on existing index (requires rebuild)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-similarity](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-similarity)

### 1.3 HNSW Index Options Tuning

**Impact: MEDIUM (Fine-tune index build and search parameters for specific workloads)**

HNSW (Hierarchical Navigable Small World) graph parameters control index build quality and search accuracy. Tune for your workload only after baseline testing with defaults.

**Incorrect: ignoring HNSW options**

```javascript
// Using only defaults without considering workload
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No hnswOptions - uses defaults
  }]
})
// Result: May be suboptimal for specific use cases
```

**Correct: configured HNSW options**

```javascript
// High-recall configuration (better accuracy)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    hnswOptions: {
      maxEdges: 64,           // More connections per node
      numEdgeCandidates: 400  // More candidates during build
    }
  }]
})

// Fast-build configuration (quicker indexing)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    hnswOptions: {
      maxEdges: 16,           // Fewer connections
      numEdgeCandidates: 100  // Minimum valid value
    }
  }]
})
```

**HNSW Parameters Explained:**

| Parameter | Default | Range | Effect |

|-----------|---------|-------|--------|

| `maxEdges` | 16 | 16-64 | Connections per node in graph |

| `numEdgeCandidates` | 100 | 100-3200 | Candidates evaluated during build |

**Trade-offs:**

```javascript
Higher maxEdges / numEdgeCandidates:
  + Better recall
  + More accurate results
  - Larger index size
  - Slower index build
  - More memory usage

Lower maxEdges / numEdgeCandidates:
  + Faster index build
  + Smaller index size
  + Less memory usage
  - Lower recall
  - May miss relevant results
```

**Recommended Configurations:**

| Use Case | maxEdges | numEdgeCandidates | Notes |

|----------|----------|-------------------|-------|

| Default | 16 | 100 | Good baseline before tuning |

| High precision | 32-64 | 400-800 | Higher recall, higher resource cost |

| Large scale | 16-32 | 100-300 | Control index cost at scale |

| Rapid prototyping | 16 | 100 | Fastest valid build profile |

**When to Adjust:**

```javascript
// Scenario 1: Low recall despite high numCandidates in queries
// Solution: Increase maxEdges for better graph connectivity
{
  hnswOptions: { maxEdges: 32, numEdgeCandidates: 400 }
}

// Scenario 2: Index build taking too long
// Solution: Reduce numEdgeCandidates
{
  hnswOptions: { maxEdges: 16, numEdgeCandidates: 150 }
}

// Scenario 3: Index too large for available RAM
// Solution: Reduce both parameters
{
  hnswOptions: { maxEdges: 16, numEdgeCandidates: 120 }
}
```

**Memory Impact:**

```javascript
Index memory ≈ numVectors × (dimensions × 4 bytes + maxEdges × 8 bytes)

Example: 1M vectors, 1536 dims, maxEdges=32
  Vectors: 1M × 1536 × 4 = 6.14 GB
  Graph:   1M × 32 × 8   = 0.26 GB
  Total:   ~6.4 GB

With maxEdges=64:
  Graph:   1M × 64 × 8   = 0.51 GB
  Total:   ~6.65 GB
```

**Verify Configuration:**

```javascript
// Check current index configuration
db.products.getSearchIndexes().forEach(idx => {
  if (idx.latestDefinition.fields) {
    idx.latestDefinition.fields.forEach(field => {
      if (field.type === "vector") {
        print(`HNSW Options: ${JSON.stringify(field.hnswOptions || "defaults")}`)
      }
    })
  }
})
```

**When NOT to use this pattern:**

- Default settings work well for most cases

- Small datasets (< 100K vectors) - minimal impact

- Using quantization (already optimizes memory)

- Teams without reproducible benchmark data for recall/latency trade-offs

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)

### 1.4 Index Filter Fields for Pre-Filtering

**Impact: CRITICAL (Missing filter indexes cause query errors or force inefficient post-filtering)**

To pre-filter vector search results, fields must be indexed with `type: "filter"`. Using unindexed fields in filters causes errors.

**Incorrect: filtering on unindexed field**

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
// Error: Path 'category' needs to be indexed as token
```

**Correct: filter fields indexed**

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

// Logical
{ $and: [{ status: "active" }, { price: { $lt: 100 } }] }
{ $or: [{ category: "A" }, { category: "B" }] }
```

**How to Verify:**

```javascript
// Check which fields are indexed for filtering
db.products.getSearchIndexes().forEach(idx => {
  print(idx.name, JSON.stringify(idx.latestDefinition.fields, null, 2))
})
```

**When NOT to use this pattern:**

- Filtering on array elements (use $in instead of direct matching)

- Filtering on nested objects (flatten to top-level fields)

- Text search filtering (use $search in hybrid search instead)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-filter)

### 1.5 Multi-Tenant Vector Search Architecture

**Impact: HIGH (Proper multi-tenant design ensures security, performance, and scalability)**

Store all tenants in a single collection with `tenant_id` field for pre-filtering. This is MongoDB's recommended pattern for multi-tenant vector search.

**Incorrect: separate collections per tenant**

```javascript
// WRONG: One collection per tenant
// Creates operational complexity, performance issues
db.tenant_acme_products.createSearchIndex("vector_index", "vectorSearch", {...})
db.tenant_globex_products.createSearchIndex("vector_index", "vectorSearch", {...})
db.tenant_initech_products.createSearchIndex("vector_index", "vectorSearch", {...})
// Result: Change stream overhead, index management nightmare
```

**Correct: single collection, tenant_id filter**

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

**Handling Large Tenants: Views Pattern**

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

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/multi-tenant-architecture/](https://mongodb.com/docs/atlas/atlas-vector-search/multi-tenant-architecture/)

### 1.6 numDimensions Must Match Embedding Model

**Impact: CRITICAL (Mismatched dimensions cause index failure or zero search results)**

The `numDimensions` in your index MUST exactly match the output dimensions of your embedding model. Mismatches cause silent failures.

**Maximum supported dimensions: 8192** (increased from 4096 in March 2025).

**Incorrect: wrong dimensions**

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

// WRONG: Exceeding maximum supported dimensions
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 9000,  // Exceeds maximum supported (8192)
    similarity: "cosine"
  }]
})
```

**Correct: matching model dimensions**

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

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-numDimensions](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/#std-label-avs-types-vector-numDimensions)

### 1.7 Partial Indexing with Views

**Impact: MEDIUM (Index only relevant documents, reduce index size and improve performance)**

Create vector indexes on Views to index only a subset of documents. Reduces index size and improves performance.

**Incorrect: indexing all documents**

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

**Correct: partial indexing via Views**

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

```javascript
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

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/view-support/](https://mongodb.com/docs/atlas/atlas-vector-search/view-support/)

### 1.8 Vector Index Definition Requirements

**Impact: CRITICAL (Missing or incorrect fields cause index creation failure or zero search results)**

A vector index requires four mandatory fields: `type`, `path`, `numDimensions`, and `similarity`. Missing any field or using incorrect values causes index creation failure or broken search.

For `numDimensions`, use a value supported by Atlas Vector Search for your vector type (for standard float vectors, up to `8192`).

**Incorrect: missing required fields**

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

**Correct: all required fields specified**

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
        numDimensions: 1536,      // Required: must match embedding model (<= 8192)
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

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)

### 1.9 Vector Quantization for Scale

**Impact: CRITICAL (Reduces RAM usage by 3.75x-24x for large vector datasets)**

Quantization compresses vectors to reduce RAM usage. Essential for datasets over 100K vectors. Scalar reduces RAM by 3.75x, binary by 24x.

**Incorrect: no quantization on large dataset**

```javascript
// WRONG: 1M vectors at 1536 dimensions without quantization
// RAM usage: ~6GB just for vectors + HNSW graph
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // Missing quantization!
  }]
})
```

**Correct: quantization enabled**

```javascript
// CORRECT: Scalar quantization (3.75x RAM reduction)
// Good for most embedding models
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "scalar"  // int8 quantization
  }]
})

// CORRECT: Binary quantization (24x RAM reduction)
// Best for normalized embeddings (OpenAI, Voyage AI)
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "binary"  // int1 quantization with rescoring
  }]
})
```

**Quantization Comparison:**

| Type | RAM Reduction | Accuracy | Best For |

|------|---------------|----------|----------|

| `none` | 1x (baseline) | Highest | < 100K vectors |

| `scalar` | 3.75x | Good | Most models, < 1M vectors |

| `binary` | 24x | Good* | Normalized embeddings, > 1M vectors |

*Binary uses rescoring to maintain accuracy

**RAM Calculation Example:**

```javascript
Without quantization:
  1M vectors × 1536 dims × 4 bytes = 6.14 GB

With scalar quantization:
  1M vectors × 1536 dims × 1 byte + HNSW = ~1.64 GB

With binary quantization:
  1M vectors × 1536 dims × 0.125 bytes + rescoring = ~0.26 GB
```

**When to Enable Quantization:**

```javascript
// Check your vector count
db.products.countDocuments({ embedding: { $exists: true } })

// Rule of thumb:
// < 100K vectors: quantization optional
// 100K - 1M vectors: use scalar
// > 1M vectors: use binary
```

**How to Verify RAM Usage:**

```javascript
// Check index size in Atlas UI:
// Clusters > Collection > Search Indexes > Size / Required Memory

// Or via aggregation (estimate):
db.products.aggregate([
  { $collStats: { storageStats: {} } }
])
```

**When NOT to use this pattern:**

- Small datasets (< 100K vectors) where accuracy is paramount

- When using low-dimensional models (< 256 dims) - less benefit

- Pre-quantized vectors from embedding model (use native format)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)

---

## 2. $vectorSearch Queries

**Impact: CRITICAL**

The `$vectorSearch` aggregation stage has strict requirements that differ from standard MongoDB queries. It MUST be the first stage in any aggregation pipeline—placing it after $match or any other stage causes errors. The queryVector must have the SAME dimensions as indexed vectors, generated by the SAME embedding model. numCandidates controls the recall/latency trade-off: too low means missed relevant results, too high means slow queries. The 20x rule (numCandidates = 20 × limit) is the recommended starting point. Pre-filtering with the `filter` parameter uses indexed filter fields to narrow candidates BEFORE vector comparison, which is far more efficient than post-filtering. New pre-filter operators include `$exists` (November 2025), `$ne` to null (September 2025), and `$not` (August 2024). For advanced text filtering (fuzzy, phrase, geo, wildcard), use the `$search.vectorSearch` operator (Lexical Prefilters - November 2025 Public Preview), which is distinct from the `$vectorSearch` aggregation stage. Scores are retrieved via `$meta: "vectorSearchScore"`, not computed manually. These query patterns are where AI assistants make the most mistakes.

### 2.1 $vectorSearch Must Be First Pipeline Stage

**Impact: CRITICAL ($vectorSearch after any other stage causes aggregation error)**

The `$vectorSearch` stage must be the first stage in any pipeline where it appears. Placing it after `$match`, `$project`, or any other stage in that same pipeline causes an error.

**Incorrect: not first stage**

```javascript
// WRONG: $match before $vectorSearch
db.products.aggregate([
  { $match: { status: "active" } },  // ERROR: Cannot be before $vectorSearch
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  }
])
// Error: $vectorSearch is only valid as the first stage in a pipeline

// WRONG: $project before $vectorSearch
db.products.aggregate([
  { $project: { embedding: 1, title: 1 } },
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  }
])
// Error: $vectorSearch is only valid as the first stage in a pipeline
```

**MongoDB 8.0+ nuance (`$unionWith` support):**

```javascript
// Allowed: $vectorSearch inside a $unionWith sub-pipeline (MongoDB 8.0+)
// But it must still be first inside that sub-pipeline
db.products.aggregate([
  {
    $vectorSearch: {
      index: "product_vectors",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5
    }
  },
  {
    $unionWith: {
      coll: "archived_products",
      pipeline: [
        {
          $vectorSearch: {
            index: "archived_product_vectors",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 200,
            limit: 5
          }
        }
      ]
    }
  }
])
```

**Correct: $vectorSearch first, then other stages**

```javascript
// CORRECT: $vectorSearch first
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  },
  { $match: { status: "active" } },  // Post-filter OK
  { $project: { title: 1, description: 1, score: { $meta: "vectorSearchScore" } } }
])

// CORRECT: Use filter parameter for pre-filtering (NOT $match)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: { status: "active" }  // Pre-filter via filter parameter
    }
  },
  { $project: { title: 1, score: { $meta: "vectorSearchScore" } } }
])
```

**Pre-filtering vs Post-filtering:**

```javascript
// PRE-FILTERING (efficient - filters before vector comparison)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: { category: "electronics" }  // GOOD: Uses indexed filter
    }
  }
])

// POST-FILTERING (less efficient - filters after vector search)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  },
  { $match: { category: "electronics" } }  // Less efficient, may return < 10 results
])
```

**Common Pipeline Pattern:**

```javascript
db.products.aggregate([
  // Stage 1: Vector search (MUST BE FIRST)
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10,
      filter: { status: "active" }
    }
  },
  // Stage 2: Add score
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" }
    }
  },
  // Stage 3: Project final fields
  {
    $project: {
      _id: 1,
      title: 1,
      description: 1,
      score: 1
    }
  }
])
```

**When NOT to use this pattern:**

- Using $search for text search (different stage, different rules)

- Hybrid search with $rankFusion (uses sub-pipelines)

- Views on MongoDB < 8.0 (not supported)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)

### 2.2 ANN vs ENN Search

**Impact: CRITICAL (Choose approximate (fast) or exact (accurate) based on use case)**

ANN (Approximate Nearest Neighbors) is fast but may miss some matches. ENN (Exact Nearest Neighbors) guarantees perfect results but is slower.

**Incorrect: always using one approach**

```javascript
// WRONG: Using ENN for real-time user queries (too slow)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      exact: true,  // Too slow for real-time!
      limit: 10
    }
  }
])
// Result: 500ms+ latency on large datasets

// WRONG: Using low numCandidates ANN for critical searches
db.legalDocs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 50,  // Too low for legal discovery
      limit: 10
    }
  }
])
// Result: Missed relevant documents in critical search
```

**Correct: choosing based on use case**

```javascript
// ANN: Real-time user-facing search (fast, good enough)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: userQueryEmbedding,
      numCandidates: 200,  // ANN with 20x rule
      limit: 10
    }
  }
])
// Result: ~10ms latency, ~90%+ recall

// ENN: Batch processing / critical searches (accurate)
db.legalDocs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: searchEmbedding,
      exact: true,  // ENN for perfect recall
      limit: 100
    }
  }
])
// Result: ~500ms latency, 100% recall

// ENN: Measuring recall accuracy of ANN
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: testQueryEmbedding,
      exact: true,  // Ground truth for testing
      limit: 10
    }
  }
])
```

**ANN vs ENN Comparison:**

| Aspect | ANN | ENN |

|--------|-----|-----|

| Parameter | `numCandidates: N` | `exact: true` |

| Speed | Fast (10-50ms) | Slower (100ms-1s+) |

| Recall | ~90-99% | 100% |

| Scaling | Scales well | Linear with data size |

| Use Case | Real-time search | Batch, critical, testing |

**Mutually Exclusive Parameters:**

```javascript
// WRONG: Cannot use both
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,  // ANN parameter
      exact: true,          // ENN parameter - CONFLICT!
      limit: 10
    }
  }
])
// Error: numCandidates and exact are mutually exclusive
```

**When to Use Each:**

```javascript
// USE ANN (numCandidates) when:
// - Real-time user queries
// - High query volume
// - Good-enough results acceptable
// - Latency matters more than perfect recall

// USE ENN (exact: true) when:
// - Legal/compliance searches
// - Scientific research
// - Measuring ANN accuracy
// - Batch processing
// - Small datasets (< 10K vectors)
// - Perfect recall required
```

**Combining with Pre-filtering:**

```javascript
// ENN with filter (manageable subset)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      exact: true,
      limit: 10,
      filter: { category: "specific" }  // Reduces candidates for ENN
    }
  }
])
// Filter reduces candidate set, making ENN faster
```

**When NOT to use this pattern:**

- ENN on > 100K vectors without filtering (too slow)

- ANN with very low numCandidates (poor recall)

- Both parameters together (mutually exclusive)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-exact](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-exact)

### 2.3 Lexical Prefilters for Vector Search

**Impact: CRITICAL (Advanced text filtering (fuzzy, phrase, geo, wildcard) before vector search)**

**Public Preview (November 2025)**: The `vectorSearch` operator inside `$search` enables advanced text analysis filters (fuzzy, phrase, geo, wildcard) BEFORE vector search. This is distinct from the `$vectorSearch` aggregation stage.

**Key Difference:**

| Feature | `$vectorSearch` Stage | `$search.vectorSearch` Operator |

|---------|----------------------|--------------------------------|

| Pipeline Position | First stage in aggregation | Inside `$search` stage |

| Pre-filter Type | MQL filters only | Atlas Search operators (fuzzy, phrase, geo, etc.) |

| Index Type | `vectorSearch` type | Atlas Search index with `vector` field type |

| Use Case | Basic filtering | Advanced lexical + semantic search |

**Incorrect: basic $vectorSearch with limited filtering**

```javascript
// LIMITED: $vectorSearch only supports basic MQL pre-filters
// Cannot use fuzzy search, phrase matching, or wildcard patterns
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: {
        category: "electronics"  // Basic equality only
        // Cannot do: fuzzy match on "electronnics"
        // Cannot do: phrase match on "high performance laptop"
        // Cannot do: wildcard "electro*"
      }
    }
  }
])
```

**Correct: using $search.vectorSearch with lexical prefilters**

```javascript
// ADVANCED: $search.vectorSearch supports Atlas Search operators
db.products.aggregate([
  {
    $search: {
      index: "search_vector_index",  // Atlas Search index with vector type
      vectorSearch: {
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: {
          compound: {
            must: [
              {
                text: {
                  query: "laptop",
                  path: "description",
                  fuzzy: { maxEdits: 1 }  // Fuzzy matching!
                }
              }
            ],
            should: [
              {
                phrase: {
                  query: "high performance",
                  path: "title"  // Phrase matching!
                }
              }
            ]
          }
        }
      }
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "searchScore" }
    }
  }
])
```

**Index Definition for Lexical Prefilters:**

```javascript
// Atlas Search index with vector type (NOT vectorSearch type!)
db.products.createSearchIndex("search_vector_index", {
  mappings: {
    fields: {
      // Vector field for semantic search
      embedding: {
        type: "vector",
        numDimensions: 1536,
        similarity: "cosine"
      },
      // Text fields for lexical prefilters
      title: {
        type: "string",
        analyzer: "lucene.standard"
      },
      description: {
        type: "string",
        analyzer: "lucene.standard"
      },
      // Location for geo prefilters
      location: {
        type: "geo"
      }
    }
  }
})
```

**Supported Lexical Prefilter Types:**

| Filter Type | Operator | Example Use Case |

|-------------|----------|------------------|

| Fuzzy Search | `text` with `fuzzy` | Match "electronnics" → "electronics" |

| Phrase Match | `phrase` | Match exact phrases "high performance" |

| Wildcard | `wildcard` | Match patterns "electro*" |

| Geo Filter | `geoWithin`, `geoShape` | Filter by location before vector search |

| Range | `range` | Date/number ranges |

| Regex | `regex` | Pattern matching |

| Compound | `compound` | Boolean logic (must, should, mustNot) |

**Geo Prefilter Example:**

```javascript
db.stores.aggregate([
  {
    $search: {
      index: "store_search_index",
      vectorSearch: {
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: {
          geoWithin: {
            path: "location",
            circle: {
              center: { type: "Point", coordinates: [-73.98, 40.75] },
              radius: 5000  // 5km radius
            }
          }
        }
      }
    }
  }
])
```

**Wildcard Prefilter Example:**

```javascript
db.products.aggregate([
  {
    $search: {
      index: "product_search_index",
      vectorSearch: {
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: {
          wildcard: {
            path: "sku",
            query: "ELEC-*-2025"  // Match pattern
          }
        }
      }
    }
  }
])
```

**Why Use Lexical Prefilters:**

1. **Advanced filtering**: Fuzzy, phrase, geo, wildcard not available in `$vectorSearch`

2. **Performance**: Filter before vector comparison (fewer candidates)

3. **Complex logic**: Boolean combinations with `compound` operator

4. **Migration path**: Replaces deprecated `knnBeta` and `knnVector`

**Limitations:**

- `vectorSearch` operator must be top-level (cannot be inside `compound` or `embeddedDocument`)

- Cannot use `highlight`, `sort`, or `searchSequenceToken` options

- Not available in MongoDB Search Playground

- Public Preview - syntax may change

**When NOT to use this pattern:**

- Basic equality filters suffice (use `$vectorSearch` stage instead)

- Not using Atlas Search features

- Need stable GA features (this is Preview)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/](https://mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/)

### 2.4 numCandidates Tuning (The 20x Rule)

**Impact: CRITICAL (Too low = missed results, too high = slow queries)**

`numCandidates` controls how many vectors are compared during ANN search. The recommended starting point is 20x your limit.

**Incorrect: numCandidates too low**

```javascript
// WRONG: numCandidates equal to limit
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 10,  // Same as limit - poor recall!
      limit: 10
    }
  }
])
// Result: Misses many relevant documents

// WRONG: numCandidates only slightly higher than limit
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 15,  // Only 1.5x limit - still poor recall
      limit: 10
    }
  }
])
```

**Correct: 20x rule for numCandidates**

```javascript
// CORRECT: 20x limit (recommended starting point)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,  // 20 × 10 = 200
      limit: 10
    }
  }
])

// CORRECT: Higher numCandidates for better recall
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 500,  // 50x limit - excellent recall
      limit: 10
    }
  }
])
```

**The 20x Rule:**

```javascript
numCandidates = 20 × limit (minimum recommended)
```

| limit | numCandidates (20x) | Better Recall (50x) | Max Allowed |

|-------|---------------------|---------------------|-------------|

| 5 | 100 | 250 | 10,000 |

| 10 | 200 | 500 | 10,000 |

| 25 | 500 | 1,250 | 10,000 |

| 50 | 1,000 | 2,500 | 10,000 |

| 100 | 2,000 | 5,000 | 10,000 |

**Trade-off Visualization:**

```javascript
numCandidates   Recall    Latency
     20x        ~90%       Low
     50x        ~95%       Medium
    100x        ~98%       Higher
    200x        ~99%       High
```

**How to Measure Recall:**

```javascript
// Compare ANN (approximate) vs ENN (exact) results
// Step 1: Get ANN results
const annResults = db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryVector,
      numCandidates: 200,  // ANN
      limit: 10
    }
  },
  { $project: { _id: 1 } }
]).toArray()

// Step 2: Get ENN results (ground truth)
const ennResults = db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryVector,
      exact: true,  // ENN - exact search
      limit: 10
    }
  },
  { $project: { _id: 1 } }
]).toArray()

// Step 3: Calculate recall
const annIds = new Set(annResults.map(d => d._id.toString()))
const matches = ennResults.filter(d => annIds.has(d._id.toString())).length
const recall = matches / ennResults.length  // Should be > 0.9
```

**When to Increase numCandidates:**

- Low recall in testing (< 90%)

- High-stakes searches where missing results is costly

- Low-dimensional vectors (< 256 dims)

- After enabling quantization

**When NOT to use this pattern:**

- Using exact search (numCandidates not used, use `exact: true`)

- numCandidates > 10,000 (MongoDB maximum)

- When latency is more important than recall

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-numCandidates](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-numCandidates)

### 2.5 Pre-Filtering Vector Search

**Impact: CRITICAL (10-100x more efficient than post-filtering, better result quality)**

Pre-filtering (using `filter` parameter) narrows candidates BEFORE vector comparison. Post-filtering (using $match after) is less efficient and may return fewer results than expected.

**Incorrect: post-filtering**

```javascript
// WRONG: Post-filtering with $match
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
      // No filter - searches ALL products
    }
  },
  { $match: { category: "electronics" } }  // Filters AFTER
])
// Problem: May return 0-10 results depending on what matched

// WRONG: Expecting exactly 10 results with post-filter
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  { $match: { status: "active", inStock: true } }
])
// Result: Could return 3 documents if only 3 of top 10 match
```

**Correct: pre-filtering**

```javascript
// CORRECT: Pre-filtering with filter parameter
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: { category: "electronics" }  // Pre-filter: more efficient
    }
  }
])
// Result: Always returns up to 10 electronics products

// CORRECT: Multiple filter conditions
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        $and: [
          { category: "electronics" },
          { status: "active" },
          { price: { $lte: 500 } }
        ]
      }
    }
  }
])
```

**Pre-filter vs Post-filter Comparison:**

| Aspect | Pre-filter | Post-filter |

|--------|------------|-------------|

| Efficiency | High (indexed) | Low (full results) |

| Result Count | Reliable (up to limit) | Variable (0 to limit) |

| Performance | Fast | Slower |

| Fields Required | Must be indexed | Any field |

**Complex Filter Examples:**

```javascript
// Range filter with pre-filtering
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        price: { $gte: 100, $lte: 500 },
        rating: { $gte: 4.0 }
      }
    }
  }
])

// Date range filter
db.articles.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        publishDate: {
          $gte: ISODate("2024-01-01"),
          $lte: ISODate("2024-12-31")
        }
      }
    }
  }
])

// $in filter for multiple values
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        category: { $in: ["electronics", "computers", "phones"] }
      }
    }
  }
])

// $exists filter (November 2025+)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        discount: { $exists: true }  // Only products with discounts
      }
    }
  }
])

// $ne to null filter (September 2025+)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        description: { $ne: null }  // Exclude null descriptions
      }
    }
  }
])

// $not filter (August 2024+)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        status: { $not: { $eq: "discontinued" } }
      }
    }
  }
])
```

**When Post-filtering is Acceptable:**

```javascript
// Filter fields must be in index definition
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    { type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" },
    { type: "filter", path: "category" },  // Must index for pre-filtering
    { type: "filter", path: "status" },
    { type: "filter", path: "price" }
  ]
})
```

**Remember: Index filter fields!**

**When NOT to use this pattern:**

- Filter field not indexed (use post-filter or update index)

- Complex computed filters (use post-filter with larger limit)

- Filtering on nested arrays (not supported in pre-filter)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter)

### 2.6 Retrieving Vector Search Scores

**Impact: HIGH (Scores enable relevance thresholds, ranking display, and quality filtering)**

Use `$meta: "vectorSearchScore"` to retrieve similarity scores. Scores enable relevance thresholds and quality assessment.

`vectorSearchScore` is normalized to a fixed range of `0` to `1` for returned documents (`1` = higher similarity). Do not treat it as a raw cosine, Euclidean distance, or dot-product value.

Starting in MongoDB 8.2, MongoDB logs a warning if `vectorSearchScore` is referenced after another query stage. Project or add the score directly after the `$vectorSearch` stage that produced it.

**Incorrect: not retrieving scores**

```javascript
// WRONG: No way to assess result quality
db.products.aggregate([
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
// Result: No visibility into match quality

// WRONG: Trying to access score without projection
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  { $match: { score: { $gte: 0.8 } } }  // score field doesn't exist!
])
```

**Correct: retrieving and using scores**

```javascript
// CORRECT: Add score via $project
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  {
    $project: {
      title: 1,
      description: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
])

// CORRECT: Add score via $addFields (keeps all fields)
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
    }
  },
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" }
    }
  }
])
```

**Score Interpretation:**

| Field | Range | Meaning |

|-------|-------|---------|

| `vectorSearchScore` | `0` to `1` | Closer to `1` = higher similarity |

**Using Scores for Thresholds:**

```javascript
// Filter by relevance threshold
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 50  // Get more, then filter by score
    }
  },
  {
    $addFields: { score: { $meta: "vectorSearchScore" } }
  },
  {
    $match: { score: { $gte: 0.75 } }  // Only high-relevance results
  },
  {
    $limit: 10
  }
])

// Score-based categories
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 20
    }
  },
  {
    $addFields: {
      score: { $meta: "vectorSearchScore" },
      relevance: {
        $switch: {
          branches: [
            { case: { $gte: [{ $meta: "vectorSearchScore" }, 0.9] }, then: "excellent" },
            { case: { $gte: [{ $meta: "vectorSearchScore" }, 0.7] }, then: "good" },
            { case: { $gte: [{ $meta: "vectorSearchScore" }, 0.5] }, then: "fair" }
          ],
          default: "low"
        }
      }
    }
  }
])
```

**Complete RAG Pattern with Scores:**

```javascript
// Retrieve context for LLM with relevance info
const context = await db.docs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5
    }
  },
  {
    $project: {
      content: 1,
      source: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]).toArray()

// Use scores to build context string
const relevantContext = context
  .filter(doc => doc.score > 0.7)  // Only high-relevance
  .map(doc => `[Score: ${doc.score.toFixed(2)}] ${doc.content}`)
  .join('\n\n')
```

**When NOT to use this pattern:**

- When you don't need relevance information

- When using scores for absolute thresholds (scores are relative)

- Comparing scores across different queries (only compare within same query)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-score](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-score)

### 2.7 Use Same Embedding Model for Data and Query

**Impact: CRITICAL (Different models = zero or garbage results)**

The embedding model used for queries MUST be the same as the model used for document embeddings. Different models produce incompatible vector spaces.

**Incorrect: mismatched models**

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

**Correct: consistent model usage**

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

**Best Practice: Track Embedding Model:**

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

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/troubleshooting/](https://mongodb.com/docs/atlas/atlas-vector-search/troubleshooting/)

---

## 3. Performance Tuning

**Impact: HIGH**

Vector search performance depends on understanding HNSW (Hierarchical Navigable Small World) graph mechanics. Vector indexes must fit in RAM—disk spillover causes severe performance degradation. For datasets over 100K vectors, quantization becomes essential: scalar quantization reduces RAM by 3.75x with minimal accuracy loss, binary quantization reduces by 24x but requires rescoring for best results. numCandidates has diminishing returns: going from 100 to 200 significantly improves recall, but 2000 to 4000 may add latency without meaningful recall gains. Pre-filtering is the most powerful optimization—reducing candidates from 1M to 10K before vector comparison is 100x more efficient than post-filtering. Use explain() on vector search queries to debug performance issues and understand query execution. For production workloads, deploy dedicated Search Nodes to isolate search from database operations and enable independent scaling. Index size monitoring via Atlas metrics and explain() analysis are essential for maintaining performance at scale.

### 3.1 Dedicated Search Nodes for Production

**Impact: HIGH (Workload isolation prevents resource contention, enables independent scaling)**

Deploy dedicated Search Nodes for production workloads. Isolates search from database operations and enables independent scaling.

**Incorrect: shared resources**

```javascript
// WRONG: Production workload on shared node
// MongoDB (mongod) and Search (mongot) compete for resources
// Cluster: M30 with Vector Search enabled
// Result: Resource contention, unpredictable latency
```

**Correct: dedicated Search Nodes**

```javascript
Production Architecture:
┌─────────────────┐     ┌─────────────────┐
│  Database Node  │     │   Search Node   │
│     (mongod)    │────▶│    (mongot)     │
│    M40 tier     │     │    S30 tier     │
└─────────────────┘     └─────────────────┘
        │                       │
   Database ops           Vector Search
   (reads/writes)          (queries)
```

**Deployment Recommendations:**

| Environment | Configuration |

|-------------|---------------|

| Development | M10/M20 (shared) |

| Staging | M30 with Search Nodes |

| Production | M40+ with dedicated Search Nodes (S30+) |

**Search Node Tiers:**

| Tier | RAM | CPUs | Best For |

|------|-----|------|----------|

| S20 (High-CPU) | 4 GB | 4 | Low latency, smaller indexes |

| S30 (Low-CPU) | 8 GB | 2 | Larger indexes, moderate queries |

| S40 | 16 GB | 4 | Large production workloads |

| S50 | 32 GB | 8 | Very large indexes |

| S80 | 64 GB | 16 | Enterprise scale |

**RAM Allocation on Search Nodes:**

```javascript
Search Nodes: ~90% RAM for vector index + JVM
Database Nodes: ~50% for MongoDB, ~50% for search (shared)

Example:
- S30 (8 GB): ~7.2 GB available for vector index
- M40 shared: ~4 GB available for vector index
```

**Sizing Your Search Nodes:**

```javascript
// Calculate required RAM
function calculateSearchNodeSize(vectorCount, dimensions, quantization = "none") {
  const bytesPerVector = {
    "none": dimensions * 4,
    "scalar": dimensions * 1,
    "binary": dimensions / 8
  }

  const indexBytes = vectorCount * bytesPerVector[quantization]
  const graphOverhead = 1.3  // ~30% for HNSW graph
  const jvmOverhead = 1.1    // ~10% for JVM

  const totalBytes = indexBytes * graphOverhead * jvmOverhead
  const requiredGB = totalBytes / (1024 ** 3)

  // Recommend 10% headroom
  return requiredGB * 1.1
}

// Example: 1M vectors, 1536 dims, no quantization
const requiredGB = calculateSearchNodeSize(1000000, 1536, "none")
console.log(`Required: ${requiredGB.toFixed(2)} GB`)  // ~8.8 GB → S40 tier
```

**Migration to Search Nodes:**

```javascript
Step 1: Ensure cluster is M10 or higher
Step 2: Select region with Search Node support
Step 3: Enable "Search Nodes for workload isolation"
Step 4: Choose search tier based on index size
Step 5: Monitor metrics during migration
```

**Benefits of Search Nodes:**

| Aspect | Shared | Dedicated Search Nodes |

|--------|--------|------------------------|

| Resource contention | Yes | No |

| Independent scaling | No | Yes |

| Cost optimization | Lower initial | Pay for what you need |

| Query latency | Variable | Predictable |

| Concurrent queries | Limited | Optimized |

**Cloud Provider Availability:**

```javascript
AWS:     Available in select regions
Azure:   Available in select regions
GCP:     Available in ALL regions
```

**Monitoring Search Nodes:**

```javascript
// Key metrics to monitor:
// 1. Search Normalized Process CPU - Should stay < 80%
// 2. System Memory - Available should exceed used
// 3. Page Faults - Should be near zero
// 4. Index Size - Must fit in Search Node RAM
```

**When NOT to use this pattern:**

- Development/testing (M10/M20 shared is sufficient)

- Small datasets (< 100K vectors)

- Cost-sensitive prototypes

- Regions without Search Node support

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/deployment-options/](https://mongodb.com/docs/atlas/atlas-vector-search/deployment-options/)

### 3.2 Enable Quantization at Scale

**Impact: HIGH (3.75x-24x RAM reduction for large vector datasets)**

Enable quantization when your vector count exceeds 100K. Without quantization, large datasets require excessive RAM and slow performance.

**Incorrect: no quantization on large dataset**

```javascript
// WRONG: 500K vectors without quantization
// RAM required: ~3GB just for vectors
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No quantization - expensive!
  }]
})
```

**Correct: quantization enabled**

```javascript
// Dataset size determines quantization type
const vectorCount = await db.products.countDocuments({ embedding: { $exists: true } })

if (vectorCount > 1000000) {
  // > 1M vectors: Use binary (24x reduction)
  db.products.createSearchIndex("vector_index", "vectorSearch", {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine",
      quantization: "binary"
    }]
  })
} else if (vectorCount > 100000) {
  // 100K-1M vectors: Use scalar (3.75x reduction)
  db.products.createSearchIndex("vector_index", "vectorSearch", {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine",
      quantization: "scalar"
    }]
  })
}
```

**RAM Calculation Guide:**

```javascript
Base RAM per vector:
  numDimensions × 4 bytes (float32)
  1536 dims × 4 = 6,144 bytes = 6 KB

Without quantization (1M vectors × 1536 dims):
  1,000,000 × 6 KB = 6 GB

With scalar quantization:
  6 GB / 3.75 = 1.6 GB

With binary quantization:
  6 GB / 24 = 0.25 GB
```

**Decision Matrix:**

| Vector Count | Quantization | RAM (1536 dims) |

|--------------|--------------|-----------------|

| < 100K | none | < 600 MB |

| 100K - 500K | scalar | 160 - 800 MB |

| 500K - 1M | scalar or binary | 160 MB - 1.6 GB |

| > 1M | binary | < 1 GB |

**Monitoring Vector Index Size:**

```javascript
// Check index status and size
db.products.getSearchIndexes().forEach(idx => {
  if (idx.type === "vectorSearch") {
    print(`Index: ${idx.name}`)
    print(`Status: ${idx.status}`)
    print(`Queryable: ${idx.queryable}`)
  }
})

// Atlas UI: Check "Required Memory" metric
// Path: Database > Collections > Search Indexes > vector_index
```

**Migrating to Quantization:**

```javascript
// Update existing index to add quantization
// Note: This triggers index rebuild
db.runCommand({
  updateSearchIndex: "products",
  name: "vector_index",
  definition: {
    fields: [{
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine",
      quantization: "binary"  // Add quantization
    }]
  }
})
```

**When NOT to use this pattern:**

- Small datasets (< 100K vectors) where accuracy is critical

- Already using pre-quantized embeddings from model

- Testing/development environments

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)

### 3.3 Explain Vector Search Queries

**Impact: HIGH (Debug performance issues and understand query execution)**

Use `explain()` to analyze vector search query execution, identify bottlenecks, and verify index usage.

**MongoDB 8.1+ Enhancement:** Explain results now include execution stats for `$search`, `$searchMeta`, and `$vectorSearch` stages.

**Incorrect: guessing performance issues**

```javascript
// WRONG: Running queries without understanding execution
db.products.aggregate([
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
// Result: No visibility into what's happening, can't optimize
```

**Correct: using explain for analysis**

```javascript
// CORRECT: Analyze query execution with explain
// Basic execution stats
db.products.explain("executionStats").aggregate([
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

// Full query plan analysis
db.products.explain("allPlansExecution").aggregate([
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

// Query planner only (fastest, no execution)
db.products.explain("queryPlanner").aggregate([
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

**Explain Verbosity Levels:**

| Level | Executes Query | Returns |

|-------|----------------|---------|

| `queryPlanner` | No | Query plan only |

| `executionStats` | Yes | Plan + execution metrics |

| `allPlansExecution` | Yes | All plans considered |

**Key Metrics to Monitor:**

```javascript
// Sample explain output fields
{
  "collectors": {
    // Collection statistics
  },
  "query": {
    "args": {
      "numCandidates": 200,    // Candidates considered
      "limit": 10              // Results returned
    },
    "stats": {
      "vectorSearchTime": 45,  // Time in ms
      "totalTime": 52
    }
  },
  "resourceUsage": {
    "memUsedBytes": 1048576,   // Memory consumed
    "cpuTimeMs": 45            // CPU time
  }
}
```

**Vector Tracing: Debug Specific Documents**

```javascript
// Trace why specific documents did/didn't appear in results
db.products.explain("executionStats").aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 10,
      explainOptions: {
        traceDocumentIds: [
          ObjectId("573a13d8f29313caabda6557"),
          ObjectId("573a1398f29313caabce98d9")
        ]
      }
    }
  }
])

// Output includes vectorTracing:
// - Whether document was visited
// - Whether it appeared in results
// - Why it was dropped (if applicable)
// - Reachability information
```

**Performance Analysis Workflow:**

```javascript
async function analyzeVectorSearchPerformance(query) {
  const queryEmbedding = await embed(query)

  // Step 1: Get execution stats
  const stats = await db.products.explain("executionStats").aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 200,
        limit: 10
      }
    }
  ]).toArray()

  // Step 2: Analyze key metrics
  const analysis = {
    vectorSearchTime: stats[0].query?.stats?.vectorSearchTime,
    numCandidates: stats[0].query?.args?.numCandidates,
    memoryUsed: stats[0].resourceUsage?.memUsedBytes,
    cpuTime: stats[0].resourceUsage?.cpuTimeMs
  }

  // Step 3: Identify issues
  if (analysis.vectorSearchTime > 100) {
    console.log("Slow query - consider increasing cluster tier or adding quantization")
  }

  return analysis
}
```

**Common Issues Identified via Explain:**

| Symptom | Likely Cause | Fix |

|---------|--------------|-----|

| High vectorSearchTime | Low numCandidates or no index | Increase numCandidates, verify index |

| High memUsedBytes | Large result set | Add pre-filtering |

| Missing documents | HNSW probabilistic nature | Increase numCandidates or use ENN |

**When NOT to use this pattern:**

- Production queries (explain adds overhead)

- Simple queries with known performance

- When using ENN (exact search behavior is deterministic)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/explain/](https://mongodb.com/docs/atlas/atlas-vector-search/explain/)

### 3.4 numCandidates Trade-offs

**Impact: HIGH (Balance recall vs latency for your use case)**

Higher numCandidates improves recall but increases latency. Find the right balance for your use case through testing.

**Incorrect: extreme values**

```javascript
// WRONG: Too low - poor recall
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 20,  // Too low for limit of 10
      limit: 10
    }
  }
])
// Result: ~60% recall, fast but missing relevant results

// WRONG: Too high - unnecessary latency
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 10000,  // Maximum - overkill for most cases
      limit: 10
    }
  }
])
// Result: ~99.9% recall, but 5x slower than needed
```

**Correct: tuned for use case**

```javascript
// Real-time search: Optimize for latency
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,  // 10x limit - fast, acceptable recall
      limit: 10
    }
  }
])
// Result: ~85% recall, < 20ms latency

// Quality-focused search: Optimize for recall
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 500,  // 50x limit - high recall
      limit: 10
    }
  }
])
// Result: ~97% recall, < 50ms latency

// Critical search: Maximum recall
db.legalDocs.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 2000,  // 200x limit
      limit: 10
    }
  }
])
// Result: ~99% recall, < 100ms latency
```

**Benchmark Your Specific Dataset:**

```javascript
async function benchmarkNumCandidates(queryVector, testCandidates = [50, 100, 200, 500, 1000]) {
  // Get ground truth with ENN
  const groundTruth = await db.products.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryVector,
        exact: true,
        limit: 10
      }
    },
    { $project: { _id: 1 } }
  ]).toArray()

  const groundTruthIds = new Set(groundTruth.map(d => d._id.toString()))

  for (const candidates of testCandidates) {
    const start = Date.now()
    const results = await db.products.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: candidates,
          limit: 10
        }
      },
      { $project: { _id: 1 } }
    ]).toArray()

    const latency = Date.now() - start
    const matches = results.filter(d => groundTruthIds.has(d._id.toString())).length
    const recall = matches / groundTruth.length

    print(`numCandidates: ${candidates}, Recall: ${(recall * 100).toFixed(1)}%, Latency: ${latency}ms`)
  }
}
```

**Typical Results Pattern:**

```javascript
numCandidates | Recall | Latency | Notes
      50      |  ~75%  |   10ms  | Too low
     100      |  ~85%  |   15ms  | Minimum viable
     200      |  ~92%  |   25ms  | Good default
     500      |  ~97%  |   45ms  | High quality
    1000      |  ~99%  |   80ms  | Near-perfect
    2000      | ~99.5% |  150ms  | Diminishing returns
```

**Use Case Guidelines:**

| Use Case | Recommended | Rationale |

|----------|-------------|-----------|

| Autocomplete | 50-100 | Speed > precision |

| Product search | 200-500 | Balance |

| RAG context | 100-200 | Good enough for context |

| Legal discovery | 1000-2000 | Can't miss relevant docs |

| Duplicate detection | 500-1000 | High precision needed |

**When NOT to use this pattern:**

- Using ENN (exact: true) - numCandidates not applicable

- Very small datasets (< 1000 vectors) - minimal impact

- When latency doesn't matter - just use high value

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)

### 3.5 Pre-filter to Narrow Candidate Set

**Impact: HIGH (Reduces vector comparisons by 10-1000x)**

Pre-filtering narrows the candidate set before vector comparison. Filtering 1M to 10K candidates = 100x fewer vector operations.

**Incorrect: no filtering on large dataset**

```javascript
// WRONG: Searching 1M vectors without filtering
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10
      // No filter - searches ALL 1M products
    }
  }
])
// Result: Slower queries, potentially irrelevant results
```

**Correct: strategic pre-filtering**

```javascript
// Filter by category first
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: { category: "electronics" }  // 1M → 100K candidates
    }
  }
])

// Multi-filter for targeted search
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 200,
      limit: 10,
      filter: {
        $and: [
          { category: "electronics" },
          { brand: "Apple" },
          { inStock: true }
        ]
      }
    }
  }
])
// 1M → 5K candidates = 200x fewer comparisons
```

**Filter Strategy by Use Case:**

```javascript
// E-commerce: Filter by department/availability
{
  filter: {
    department: userSelectedDepartment,
    inStock: true,
    status: "active"
  }
}

// Multi-tenant: Filter by tenant ID (critical!)
{
  filter: {
    tenantId: currentTenantId  // Security + performance
  }
}

// Time-sensitive: Filter by date range
{
  filter: {
    createdAt: {
      $gte: ISODate("2024-01-01"),
      $lte: ISODate("2024-12-31")
    }
  }
}

// User-specific: Filter by access permissions
{
  filter: {
    $or: [
      { visibility: "public" },
      { authorId: currentUserId },
      { sharedWith: { $in: [currentUserId] } }
    ]
  }
}
```

**Performance Impact Example:**

```javascript
Without filter (1M docs):
  - Vector comparisons: 1,000,000
  - Latency: ~150ms

With category filter (100K docs in category):
  - Vector comparisons: 100,000
  - Latency: ~40ms
  - Improvement: 3.75x faster

With multi-filter (10K docs matching all):
  - Vector comparisons: 10,000
  - Latency: ~15ms
  - Improvement: 10x faster
```

**Index Definition for Filters:**

```javascript
// Include all filterable fields in index
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    // Add filter fields
    { type: "filter", path: "category" },
    { type: "filter", path: "brand" },
    { type: "filter", path: "inStock" },
    { type: "filter", path: "status" },
    { type: "filter", path: "tenantId" },
    { type: "filter", path: "createdAt" }
  ]
})
```

**Analyze Filter Effectiveness:**

```javascript
// Check cardinality of filter fields
db.products.aggregate([
  {
    $group: {
      _id: "$category",
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } }
])
// High-cardinality filters are most effective

// Check filter selectivity
const total = await db.products.countDocuments()
const filtered = await db.products.countDocuments({ category: "electronics" })
console.log(`Filter selectivity: ${((total - filtered) / total * 100).toFixed(1)}%`)
// Higher % = more effective filter
```

**When NOT to use this pattern:**

- Filter removes too many candidates (< 100 remaining)

- Filter field not indexed (will error or post-filter)

- Need results across all categories

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter)

### 3.6 Vector Index Must Fit in RAM

**Impact: HIGH (Disk spillover causes 10-100x performance degradation)**

Vector indexes use HNSW graphs that must fit in RAM for acceptable performance. Disk spillover causes severe latency degradation.

**Incorrect: index exceeds available RAM**

```javascript
// WRONG: Large index on small instance
// 2M vectors × 1536 dims = ~12GB index
// Running on M30 with 8GB RAM = spillover to disk

db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine"
    // No quantization on 2M vectors = 12GB needed
  }]
})
// Result: Query latency goes from 50ms to 5000ms
```

**Correct: size index to fit RAM**

```javascript
// Option 1: Enable quantization to reduce RAM
db.products.createSearchIndex("vector_index", "vectorSearch", {
  fields: [{
    type: "vector",
    path: "embedding",
    numDimensions: 1536,
    similarity: "cosine",
    quantization: "binary"  // Reduces to ~0.5GB
  }]
})

// Option 2: Upgrade cluster tier
// M30 (8GB) → M40 (16GB) → M50 (32GB)

// Option 3: Use partial indexing approach
// Only index active/recent documents
db.products.createSearchIndex("active_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    {
      type: "filter",
      path: "status"
    }
  ]
})
// Then always filter: filter: { status: "active" }
```

**RAM Requirements by Cluster Tier:**

| Tier | RAM | Max Vectors (no quant) | Max Vectors (binary) |

|------|-----|------------------------|----------------------|

| M10 | 2 GB | ~300K | ~7M |

| M20 | 4 GB | ~600K | ~14M |

| M30 | 8 GB | ~1.2M | ~28M |

| M40 | 16 GB | ~2.4M | ~56M |

| M50 | 32 GB | ~5M | ~112M |

*Based on 1536-dimensional vectors*

**Calculate Your Index Size:**

```javascript
// Estimate index RAM requirement
function estimateVectorIndexRAM(vectorCount, dimensions, quantization = "none") {
  const bytesPerVector = {
    "none": dimensions * 4,      // float32
    "scalar": dimensions * 1,    // int8
    "binary": dimensions / 8     // int1
  }

  const vectorBytes = vectorCount * bytesPerVector[quantization]
  const hnswOverhead = 1.3  // Graph overhead ~30%

  return (vectorBytes * hnswOverhead) / (1024 * 1024 * 1024)  // GB
}

// Example
const count = await db.products.countDocuments({ embedding: { $exists: true } })
console.log(`Vectors: ${count}`)
console.log(`RAM (no quant): ${estimateVectorIndexRAM(count, 1536, "none").toFixed(2)} GB`)
console.log(`RAM (scalar): ${estimateVectorIndexRAM(count, 1536, "scalar").toFixed(2)} GB`)
console.log(`RAM (binary): ${estimateVectorIndexRAM(count, 1536, "binary").toFixed(2)} GB`)
```

**Monitor Index Memory in Atlas:**

```javascript
Atlas UI Path:
1. Database Deployments
2. Click cluster name
3. Metrics tab
4. Select "Search" process
5. Check "Memory Usage" metric

Or via Atlas Admin API:
GET /api/atlas/v1.0/groups/{groupId}/processes/{processId}/measurements
```

**Signs of Memory Pressure:**

- Query latency spikes (50ms → 500ms+)

- Inconsistent query times

- "Memory limit exceeded" in logs

- Atlas alerts for search process memory

**When NOT to use this pattern:**

- Using dedicated Search Nodes (separate memory pool)

- Serverless instances (auto-scaling)

- Development/testing with small datasets

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/sizing-tier-selection/](https://mongodb.com/docs/atlas/sizing-tier-selection/)

---

## 4. RAG Patterns

**Impact: HIGH**

RAG (Retrieval-Augmented Generation) is the primary use case for vector search. The pattern has three phases: Ingestion stores documents with their embeddings, Retrieval uses $vectorSearch to find semantically relevant context, Generation passes that context to the LLM. Common mistakes include: using different embedding models for ingestion and retrieval (results in zero matches), not chunking documents (large documents dilute embedding relevance), exceeding LLM context windows (wasted tokens and truncation), and not including metadata for filtering (can't narrow by date, source, or category). The retrieval phase should return scores to enable relevance thresholding. Metadata filtering during retrieval is more efficient than post-retrieval filtering.

### 4.1 Managing LLM Context Window Limits

**Impact: HIGH (Exceeding context limits causes truncation or errors)**

LLMs have token limits. RAG must fit retrieved context + query + response within these limits.

**Incorrect: ignoring limits**

```javascript
// WRONG: Retrieving too much context
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 50  // 50 chunks × ~500 tokens = 25,000 tokens!
    }
  }
]).toArray()

const fullContext = context.map(c => c.content).join('\n\n')
// Result: Exceeds GPT-4's context, gets truncated or errors
```

**Correct: context-aware retrieval**

```javascript
// Token estimation (rough: 1 token ≈ 4 characters for English)
function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

// Context-aware retrieval
async function retrieveWithinTokenLimit(query, options = {}) {
  const {
    maxContextTokens = 4000,  // Reserve tokens for context
    maxResponseTokens = 1000, // Reserve for response
    modelLimit = 8192         // GPT-4 limit
  } = options

  // Calculate available context budget
  const queryTokens = estimateTokens(query)
  const systemPromptTokens = 500  // Estimate for system prompt
  const availableTokens = modelLimit - queryTokens - systemPromptTokens - maxResponseTokens

  const contextBudget = Math.min(availableTokens, maxContextTokens)

  // Retrieve chunks
  const queryEmbedding = await embeddingClient.embed(query)
  const chunks = await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 200,
        limit: 20  // Get more than needed, then filter
      }
    },
    {
      $addFields: { score: { $meta: "vectorSearchScore" } }
    },
    {
      $project: { content: 1, score: 1, source: 1 }
    }
  ]).toArray()

  // Select chunks within budget
  const selectedChunks = []
  let usedTokens = 0

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.content)
    if (usedTokens + chunkTokens <= contextBudget) {
      selectedChunks.push(chunk)
      usedTokens += chunkTokens
    } else {
      break  // Stop when budget exhausted
    }
  }

  return {
    chunks: selectedChunks,
    tokensUsed: usedTokens,
    tokenBudget: contextBudget
  }
}
```

**Model Token Limits:**

| Model | Context Limit | Safe Context Budget |

|-------|---------------|---------------------|

| GPT-3.5-turbo | 16,384 | 12,000 |

| GPT-4 | 8,192 | 6,000 |

| GPT-4-turbo | 128,000 | 100,000 |

| Claude 3 Sonnet | 200,000 | 150,000 |

| Claude 3 Opus | 200,000 | 150,000 |

**Dynamic Context Sizing:**

```javascript
async function smartContextRetrieval(query, modelConfig) {
  const {
    contextLimit,
    reserveForResponse = 2000,
    reserveForSystemPrompt = 500
  } = modelConfig

  // Calculate dynamic limits based on query
  const queryTokens = estimateTokens(query)
  const availableForContext = contextLimit - queryTokens - reserveForResponse - reserveForSystemPrompt

  // Adjust chunk count based on available space
  const avgChunkTokens = 400  // Your average chunk size
  const maxChunks = Math.floor(availableForContext / avgChunkTokens)

  const chunks = await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embeddingClient.embed(query),
        numCandidates: maxChunks * 20,
        limit: maxChunks
      }
    },
    { $addFields: { score: { $meta: "vectorSearchScore" } } }
  ]).toArray()

  return chunks
}
```

**Chunking for Context Efficiency:**

```javascript
// Optimal chunk sizes for RAG
const chunkingConfig = {
  // Smaller chunks = more precise retrieval
  precisionFocused: {
    chunkSize: 500,     // ~125 tokens
    overlap: 100,
    retrieveCount: 8    // Fit ~1000 tokens of context
  },

  // Larger chunks = more context per chunk
  contextFocused: {
    chunkSize: 1500,    // ~375 tokens
    overlap: 200,
    retrieveCount: 4    // Same ~1500 tokens, fewer chunks
  },

  // Large context models
  largeContext: {
    chunkSize: 2000,    // ~500 tokens
    overlap: 300,
    retrieveCount: 20   // ~10,000 tokens of context
  }
}
```

**When NOT to use this pattern:**

- Using models with very large context (200K+) - less critical

- Simple Q&A with single short documents

- When full document is required regardless of length

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/rag/](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)

### 4.2 RAG Ingestion Pattern

**Impact: HIGH (Proper ingestion enables effective semantic retrieval)**

Proper RAG ingestion includes chunking, embedding, and storing metadata. Poor ingestion leads to retrieval failures.

**Incorrect: naive ingestion**

```javascript
// WRONG: No chunking - dilutes embedding relevance
await db.documents.insertOne({
  content: entireLargeDocument,  // 50,000 words as one chunk!
  embedding: await embed(entireLargeDocument)
})
// Result: Embedding averages over too much content, loses specificity

// WRONG: No metadata - can't filter or trace source
await db.documents.insertOne({
  content: chunk,
  embedding: await embed(chunk)
  // No source, date, category, or tracking info
})
```

**Correct: structured ingestion**

```javascript
// Proper RAG document schema
const ragDocumentSchema = {
  // Content
  content: String,        // The chunk text
  embedding: [Number],    // Vector embedding

  // Source tracking
  source: {
    documentId: ObjectId, // Original document
    fileName: String,
    url: String,
    pageNumber: Number
  },

  // Chunking info
  chunk: {
    index: Number,        // Position in original doc
    totalChunks: Number,
    startChar: Number,
    endChar: Number
  },

  // Metadata for filtering
  metadata: {
    category: String,
    author: String,
    createdAt: Date,
    lastUpdated: Date
  },

  // Embedding info
  embeddingModel: String,
  embeddingDimensions: Number
}

// Complete ingestion function
async function ingestDocument(document, embeddingClient) {
  // Step 1: Chunk the document
  const chunks = chunkDocument(document.content, {
    chunkSize: 1000,      // ~1000 characters per chunk
    overlap: 200          // 200 char overlap for context
  })

  // Step 2: Generate embeddings for all chunks
  const embeddings = await embeddingClient.embedBatch(
    chunks.map(c => c.text)
  )

  // Step 3: Store with full metadata
  const docs = chunks.map((chunk, i) => ({
    content: chunk.text,
    embedding: embeddings[i],

    source: {
      documentId: document._id,
      fileName: document.fileName,
      url: document.url
    },

    chunk: {
      index: i,
      totalChunks: chunks.length,
      startChar: chunk.start,
      endChar: chunk.end
    },

    metadata: {
      category: document.category,
      author: document.author,
      createdAt: new Date(),
      lastUpdated: new Date()
    },

    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536
  }))

  await db.ragChunks.insertMany(docs)
}
```

**Chunking Strategy:**

```javascript
// Simple overlap chunking
function chunkDocument(text, { chunkSize = 1000, overlap = 200 }) {
  const chunks = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push({
      text: text.slice(start, end),
      start,
      end
    })
    start += chunkSize - overlap
  }

  return chunks
}

// Semantic chunking (better quality)
function chunkByParagraphs(text, maxChunkSize = 1500) {
  const paragraphs = text.split(/\n\n+/)
  const chunks = []
  let currentChunk = ""

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = para
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks
}
```

**Index for RAG Collection:**

```javascript
db.ragChunks.createSearchIndex("rag_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    { type: "filter", path: "metadata.category" },
    { type: "filter", path: "source.documentId" },
    { type: "filter", path: "metadata.createdAt" }
  ]
})
```

**When NOT to use this pattern:**

- Very short documents (no chunking needed)

- Structured data (embed individual fields instead)

- Real-time streaming (requires incremental approach)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/rag/](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)

### 4.3 RAG Metadata Filtering

**Impact: HIGH (Filters improve relevance and enable scoped searches)**

Use metadata filters to scope RAG searches by source, date, category, or user permissions.

**Incorrect: no filtering**

```javascript
// WRONG: Search entire knowledge base without scoping
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5
      // No filter - searches everything
    }
  }
]).toArray()
// Result: May return outdated docs, wrong department, or unauthorized content
```

**Correct: metadata-scoped retrieval**

```javascript
// Time-scoped: Recent documents only
async function retrieveRecent(query, daysBack = 90) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)

  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          "metadata.createdAt": { $gte: cutoffDate }
        }
      }
    }
  ]).toArray()
}

// Category-scoped: Specific knowledge domain
async function retrieveByCategory(query, category) {
  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          "metadata.category": category
        }
      }
    }
  ]).toArray()
}

// Source-scoped: Specific document or collection
async function retrieveFromSource(query, sourceId) {
  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          "source.documentId": ObjectId(sourceId)
        }
      }
    }
  ]).toArray()
}

// Permission-scoped: User-authorized content
async function retrieveAuthorized(query, userId, userRoles) {
  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          $or: [
            { "metadata.visibility": "public" },
            { "metadata.authorId": userId },
            { "metadata.allowedRoles": { $in: userRoles } }
          ]
        }
      }
    }
  ]).toArray()
}
```

**Complex Filter Patterns:**

```javascript
// Multi-dimensional filter
async function advancedRetrieval(query, filters) {
  const {
    category,
    dateRange,
    sources,
    excludeTags,
    userId
  } = filters

  const filterConditions = []

  if (category) {
    filterConditions.push({ "metadata.category": category })
  }

  if (dateRange) {
    filterConditions.push({
      "metadata.createdAt": {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    })
  }

  if (sources?.length) {
    filterConditions.push({
      "source.documentId": { $in: sources.map(s => ObjectId(s)) }
    })
  }

  if (excludeTags?.length) {
    filterConditions.push({
      "metadata.tags": { $nin: excludeTags }
    })
  }

  // Always enforce authorization
  filterConditions.push({
    $or: [
      { "metadata.visibility": "public" },
      { "metadata.authorId": userId }
    ]
  })

  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: filterConditions.length > 1
          ? { $and: filterConditions }
          : filterConditions[0]
      }
    }
  ]).toArray()
}
```

**Index Definition for Metadata Filtering:**

```javascript
db.ragChunks.createSearchIndex("rag_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    // All filterable metadata fields
    { type: "filter", path: "metadata.category" },
    { type: "filter", path: "metadata.createdAt" },
    { type: "filter", path: "metadata.visibility" },
    { type: "filter", path: "metadata.authorId" },
    { type: "filter", path: "metadata.allowedRoles" },
    { type: "filter", path: "metadata.tags" },
    { type: "filter", path: "source.documentId" }
  ]
})
```

**User Interface Filter Options:**

```javascript
// API endpoint with filter parameters
app.post('/api/rag/search', async (req, res) => {
  const {
    query,
    filters: {
      category = null,
      startDate = null,
      endDate = null,
      sources = null
    }
  } = req.body

  const context = await advancedRetrieval(query, {
    category,
    dateRange: startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : null,
    sources,
    userId: req.user.id
  })

  res.json({ context })
})
```

**When NOT to use this pattern:**

- Very small knowledge bases (filtering may return nothing)

- Open-ended exploration queries

- When filter fields aren't indexed

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter)

### 4.4 RAG Retrieval Pattern

**Impact: HIGH (Effective retrieval provides relevant context for LLM generation)**

Retrieval uses $vectorSearch to find semantically relevant chunks, then formats them for LLM context.

**Incorrect: poor retrieval**

```javascript
// WRONG: No score filtering - includes low-relevance results
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 10
    }
  }
]).toArray()
// Result: Context includes irrelevant chunks, confuses LLM

// WRONG: No source tracking - can't cite sources
const response = await llm.chat([
  { role: "system", content: context.map(c => c.content).join('\n') },
  { role: "user", content: userQuery }
])
// Result: No way to verify or cite sources
```

**Correct: quality retrieval**

```javascript
// Complete RAG retrieval function
async function retrieveContext(userQuery, options = {}) {
  const {
    limit = 5,
    minScore = 0.7,
    category = null
  } = options

  // Step 1: Embed the query
  const queryEmbedding = await embeddingClient.embed(userQuery)

  // Step 2: Vector search with optional filter
  const pipeline = [
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: limit * 20,  // 20x rule
        limit: limit * 2,            // Get extra for score filtering
        ...(category && { filter: { "metadata.category": category } })
      }
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" }
      }
    },
    {
      $match: {
        score: { $gte: minScore }  // Filter low-relevance
      }
    },
    {
      $limit: limit
    },
    {
      $project: {
        content: 1,
        score: 1,
        source: 1,
        "metadata.category": 1
      }
    }
  ]

  const results = await db.ragChunks.aggregate(pipeline).toArray()

  // Step 3: Format for LLM with source tracking
  const contextWithSources = results.map((doc, i) => ({
    index: i + 1,
    content: doc.content,
    score: doc.score,
    source: doc.source?.fileName || "Unknown",
    citation: `[${i + 1}]`
  }))

  return contextWithSources
}

// Usage in RAG pipeline
async function ragQuery(userQuery) {
  const context = await retrieveContext(userQuery, {
    limit: 5,
    minScore: 0.75
  })

  // Build prompt with sources
  const systemPrompt = `You are a helpful assistant. Answer based ONLY on the provided context.
If the context doesn't contain relevant information, say "I don't have information about that."
Cite sources using [1], [2], etc.

Context:
${context.map(c => `${c.citation} ${c.content}`).join('\n\n')}

Sources:
${context.map(c => `${c.citation} ${c.source}`).join('\n')}`

  const response = await llm.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery }
  ])

  return {
    answer: response,
    sources: context.map(c => ({ citation: c.citation, source: c.source, score: c.score }))
  }
}
```

**Retrieval Quality Checks:**

```javascript
// Check retrieval quality before sending to LLM
function validateContext(context) {
  if (context.length === 0) {
    return { valid: false, reason: "No relevant context found" }
  }

  const avgScore = context.reduce((sum, c) => sum + c.score, 0) / context.length
  if (avgScore < 0.6) {
    return { valid: false, reason: "Low average relevance score" }
  }

  if (context[0].score < 0.7) {
    return { valid: false, reason: "Best match has low relevance" }
  }

  return { valid: true }
}

// Usage
const context = await retrieveContext(userQuery)
const validation = validateContext(context)

if (!validation.valid) {
  return `I don't have enough relevant information to answer that. ${validation.reason}`
}
```

**Multi-Query Retrieval (Better Recall):**

```javascript
// Generate multiple query variations for better retrieval
async function multiQueryRetrieval(userQuery) {
  // Generate query variations
  const variations = await llm.chat([
    {
      role: "system",
      content: "Generate 3 different phrasings of this question for search. Return as JSON array."
    },
    { role: "user", content: userQuery }
  ])

  const queries = [userQuery, ...JSON.parse(variations)]

  // Retrieve for each query
  const allResults = []
  for (const query of queries) {
    const results = await retrieveContext(query, { limit: 3 })
    allResults.push(...results)
  }

  // Deduplicate and re-rank by score
  const seen = new Set()
  return allResults
    .filter(r => {
      const key = r.content.substring(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
```

**When NOT to use this pattern:**

- Direct factual questions (use regular queries)

- Real-time chat without knowledge base

- When entire document needed (not chunk-based)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/rag/](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)

---

## 5. Hybrid Search

**Impact: MEDIUM**

Hybrid search combines vector (semantic) search with traditional text (lexical) search using $rankFusion or $scoreFusion. This captures both conceptual similarity and exact keyword matches. $rankFusion (MongoDB 8.0+) uses Reciprocal Rank Fusion to merge result lists by position. $scoreFusion (MongoDB 8.2+) merges by actual score values with normalization options (sigmoid, minMaxScaler) and custom combination expressions, offering more granular control for applications where score magnitudes matter. MongoDB 8.2 docs currently classify fusion-stage capabilities as Preview features, so treat behavior and output contracts as release-sensitive. Key constraints: sub-pipelines run serially (not parallel), same-collection only (use $unionWith for cross-collection), limited stages allowed ($search, $vectorSearch, $match, $sort, $geoNear), no pagination support. Weights should be tuned per-query rather than globally—a technical query might weight lexical higher, while a conceptual query weights semantic higher.

### 5.1 Hybrid Search Limitations

**Impact: MEDIUM (Understanding constraints prevents runtime errors)**

`$rankFusion` and `$scoreFusion` have specific constraints. Understanding them prevents errors.

Current MongoDB 8.2 docs describe fusion stages as Preview features. Keep rollout plans conservative and validate on your exact target release.

**Incorrect: violating limitations**

```javascript
// WRONG: Using $project in sub-pipeline
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [
            { $vectorSearch: { ... } },
            { $project: { title: 1 } }  // NOT ALLOWED!
          ]
        }
      }
    }
  }
])
// Error: $project not supported in $rankFusion sub-pipelines

// WRONG: Cross-collection search
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          products: [{ $vectorSearch: { index: "products_vector", ... } }],
          reviews: [
            { $lookup: { from: "reviews", ... } }  // NOT ALLOWED!
          ]
        }
      }
    }
  }
])
// Error: All pipelines must search same collection
```

**Correct: working within constraints**

```javascript
// Project AFTER $rankFusion, not inside
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 20
              }
            }
          ],
          text: [
            {
              $search: {
                index: "text_index",
                text: { query: searchTerm, path: "description" }
              }
            },
            { $limit: 20 }  // $limit IS allowed
          ]
        }
      }
    }
  },
  { $limit: 10 },
  { $project: { title: 1, description: 1 } }  // Project AFTER
])
```

**Allowed Stages in Sub-Pipelines:**

| Stage | Allowed | Notes |

|-------|---------|-------|

| `$vectorSearch` | Yes | Vector search |

| `$search` | Yes | Full-text search |

| `$match` | Yes | Filter documents |

| `$sort` | Yes | Re-order results |

| `$limit` | Yes | Limit results |

| `$geoNear` | Yes | Geographic search |

| `$project` | **No** | Use after $rankFusion |

| `$group` | **No** | Not supported |

| `$lookup` | **No** | Same collection only |

| `$unwind` | **No** | Not supported |

**Key Limitations:**

```javascript
// 1. MongoDB 8.0+ required for $rankFusion
// 2. MongoDB 8.2+ required for $scoreFusion

// 3. Sub-pipelines run SERIALLY (not parallel)
// Performance tip: Limit results in each sub-pipeline
{
  $rankFusion: {
    input: {
      pipelines: {
        a: [{ $vectorSearch: { ..., limit: 20 } }],  // Limit here
        b: [{ $search: { ... } }, { $limit: 20 }]    // Limit here
      }
    }
  }
}

// 4. No pagination support
// Can't use skip/limit across fused results
// Workaround: Request more results and paginate in application

// 5. Same collection only
// For cross-collection, use $unionWith separately
db.products.aggregate([
  {
    $unionWith: {
      coll: "reviews",
      pipeline: [
        { $vectorSearch: { index: "reviews_vector", ... } }
      ]
    }
  },
  // Then sort/rank manually
  { $sort: { score: -1 } },
  { $limit: 10 }
])

// 6. No storedSource fields from $search
// Can't use returnStoredSource with $rankFusion

// 7. Release-sensitive behavior
// Re-check release notes before upgrades because fusion-stage behavior and constraints can evolve.
```

**Cross-Collection Alternative:**

```javascript
// Use $unionWith for multi-collection search
async function crossCollectionSearch(query) {
  const queryEmbedding = await embed(query)

  return db.products.aggregate([
    // Search products
    {
      $vectorSearch: {
        index: "products_vector",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10
      }
    },
    { $addFields: { source: "products", score: { $meta: "vectorSearchScore" } } },

    // Union with reviews search
    {
      $unionWith: {
        coll: "reviews",
        pipeline: [
          {
            $vectorSearch: {
              index: "reviews_vector",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 10
            }
          },
          { $addFields: { source: "reviews", score: { $meta: "vectorSearchScore" } } }
        ]
      }
    },

    // Combine and sort
    { $sort: { score: -1 } },
    { $limit: 10 }
  ]).toArray()
}
```

**When NOT to use this pattern:**

- Need cross-collection search (use $unionWith)

- Need pagination (implement in application layer)

- Need complex transformations in sub-pipelines

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/#limitations](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/#limitations)

### 5.2 Rank-Based Hybrid Search with $rankFusion

**Impact: MEDIUM (Combines semantic and lexical search using Reciprocal Rank Fusion)**

`$rankFusion` (MongoDB 8.0+) combines ranked pipeline results using Reciprocal Rank Fusion (RRF).

As documented in current MongoDB 8.2 docs, fusion stages are Preview features. Treat output shape and behavior as release-sensitive and re-validate during upgrades.

Version gates to apply:

- `\$rankFusion` stage availability: **MongoDB 8.0+**

- `\$vectorSearch` inside `\$rankFusion.input.pipelines`: **MongoDB 8.1+**

- `\$rankFusion` on **views**: **MongoDB 8.2+**

- **Feature maturity:** treat hybrid fusion capabilities as release-sensitive; re-check release notes during upgrades before relying on strict output contracts.

**$rankFusion vs $scoreFusion:**

| Feature | $rankFusion | $scoreFusion |

|---------|-------------|--------------|

| MongoDB Version | 8.0+ | 8.2+ |

| `$vectorSearch` in input pipelines | 8.1+ | 8.2+ |

| Algorithm | Reciprocal Rank Fusion | Score-based arithmetic |

| Uses | Document position/rank | Actual score values |

| Normalization | None (rank-based) | sigmoid, minMaxScaler, none |

| Custom Expressions | No | Yes |

**Incorrect: separate queries and manual merge**

```javascript
// WRONG: Running separate queries and merging manually
const vectorResults = await db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10
    }
  }
]).toArray()

const textResults = await db.products.aggregate([
  {
    $search: {
      index: "text_index",
      text: { query: "laptop", path: "description" }
    }
  },
  { $limit: 10 }
]).toArray()

// Manual merge is complex, error-prone, and loses ranking info
```

**Correct: using $rankFusion with vector + text on MongoDB 8.1+**

```javascript
// CORRECT: Single hybrid query with $rankFusion
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          // Vector (semantic) search
          vector: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 20
              }
            }
          ],
          // Text (lexical) search
          text: [
            {
              $search: {
                index: "text_index",
                text: {
                  query: "laptop for programming",
                  path: "description"
                }
              }
            },
            { $limit: 20 }
          ]
        }
      }
    }
  },
  { $limit: 10 },
  {
    $project: {
      title: 1,
      description: 1,
      score: { $meta: "score" }  // RRF combined score
    }
  }
])
```

**MongoDB 8.0-compatible pattern (without `$vectorSearch` in input pipelines):**

```javascript
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          textA: [
            { $search: { index: "text_index", text: { query: "laptop", path: "title" } } },
            { $limit: 20 }
          ],
          textB: [
            { $search: { index: "text_index", text: { query: "programming", path: "description" } } },
            { $limit: 20 }
          ]
        }
      },
      combination: {
        weights: { textA: 0.6, textB: 0.4 }
      }
    }
  },
  { $limit: 10 }
])
```

**With Weights: prioritize one method**

```javascript
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          text: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "description" }
            }
          }, { $limit: 20 }]
        }
      },
      combination: {
        weights: {
          vector: 0.7,  // Semantic weight
          text: 0.3     // Lexical weight
        }
      }
    }
  },
  { $limit: 10 }
])
```

**Score Details for Debugging:**

```javascript
// Enable scoreDetails to understand rank composition
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }, { $limit: 20 }]
        }
      },
      combination: {
        weights: { vector: 0.7, text: 0.3 }
      },
      scoreDetails: true  // Include detailed ranking info
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "score" },
      scoreDetails: { $meta: "scoreDetails" }
      // scoreDetails contains: value, description, and per-pipeline
      // breakdown with rank, weight, and inputPipelineName
    }
  },
  { $limit: 10 }
])
```

**Reciprocal Rank Fusion Formula:**

```javascript
RRF = 0.7 × (1/61) + 0.3 × (1/63) = 0.01148 + 0.00476 = 0.01624
```

Example: Document at rank 1 in vector (weight=0.7) and rank 3 in text (weight=0.3):

**Allowed Stages in Sub-Pipelines:**

| Type | Allowed Stages |

|------|----------------|

| Search | `$vectorSearch`, `$search`, `$match`, `$geoNear`, `$sample` |

| Ordering | `$sort` |

| Pagination | `$skip`, `$limit` |

**Key Behaviors:**

- **De-duplication**: Documents appear at most once in output, even if matched by multiple pipelines

- **Single collection only**: Cannot span multiple collections (use `$unionWith` for cross-collection)

- **Pipeline names**: Cannot start with `$`, cannot contain `.` or null character

- **Views support**: `$rankFusion` on views is available starting in MongoDB 8.2

**When to use $rankFusion over $scoreFusion:**

- MongoDB 8.0 or 8.1 (before 8.2)

- Position/rank matters more than score magnitude

- Simpler hybrid search without normalization needs

- Established RRF algorithm behavior desired

- Need view support only if cluster is MongoDB 8.2+

**When NOT to use this pattern:**

- MongoDB version < 8.0 (not supported)

- Only semantic search needed (use $vectorSearch alone)

- Only exact matching needed (use $search alone)

- Need fine-grained score control (use $scoreFusion in 8.2+)

- Cross-collection search (use $unionWith)

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/](https://mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/)

### 5.3 Score-Based Hybrid Search with $scoreFusion

**Impact: MEDIUM (Fine-grained score combination for improved relevance tuning)**

`$scoreFusion` (MongoDB 8.2+) combines multiple search pipelines using actual scores rather than ranks, with support for normalization and custom combination expressions.

As documented in current MongoDB 8.2 docs, fusion stages are Preview features. Re-validate behavior and compatibility assumptions on every release upgrade.

**Feature maturity note:** validate behavior against current release notes before production rollout because fusion-stage capabilities can evolve between MongoDB release lines.

**$scoreFusion vs $rankFusion:**

| Feature | $rankFusion | $scoreFusion |

|---------|-------------|--------------|

| MongoDB Version | 8.0+ | 8.2+ |

| Combination Method | Reciprocal Rank Fusion | Score-based arithmetic |

| Normalization | None | sigmoid, minMaxScaler, none |

| Custom Expressions | No | Yes |

| Score Details | No | Yes |

**Incorrect: using $rankFusion when scores matter**

```javascript
// WRONG: $rankFusion ignores actual score values
// A document at rank 1 with score 0.99 is treated the same
// as rank 1 with score 0.51 - losing precision
db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }]
        },
        weights: { vector: 0.5, text: 0.5 }
      }
    }
  }
])
// Result: High-confidence matches not distinguished from marginal ones
```

**Correct: using $scoreFusion for score-aware combination**

```javascript
// CORRECT: $scoreFusion uses actual scores with normalization
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          vector: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          text: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "description" }
            }
          }, { $limit: 20 }]
        },
        normalization: "sigmoid"  // Normalize scores to 0-1
      },
      combination: {
        weights: { vector: 0.6, text: 0.4 }
        // Default method: "avg" - weighted average of normalized scores
      }
    }
  },
  { $limit: 10 }
])
```

**Custom Score Expression:**

```javascript
// Use custom arithmetic expression for fine-grained control
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          semantic: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          lexical: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "title" }
            }
          }, { $limit: 20 }]
        },
        normalization: "minMaxScaler"
      },
      combination: {
        method: "expression",
        expression: {
          // Custom formula: weight semantic higher, boost exact matches
          $sum: [
            { $multiply: ["$$semantic", 10] },
            "$$lexical"
          ]
        }
      }
    }
  },
  { $limit: 10 }
])
```

**Score Details for Debugging:**

```javascript
// Enable scoreDetails to understand score composition
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }]
        },
        normalization: "sigmoid"
      },
      combination: {
        weights: { vector: 0.7, text: 0.3 }
      },
      scoreDetails: true  // Include detailed scoring info
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "score" },
      scoreDetails: { $meta: "scoreDetails" }
      // scoreDetails contains: value, description, normalization,
      // combination method, and per-pipeline breakdown
    }
  },
  { $limit: 10 }
])
```

**Normalization Methods:**

| Method | Description | Use Case |

|--------|-------------|----------|

| `none` | No normalization | Scores already comparable |

| `sigmoid` | Apply sigmoid function | Different score distributions |

| `minMaxScaler` | Scale to 0-1 range | Varying score magnitudes |

**When to use $scoreFusion over $rankFusion:**

- Need fine-grained control over score combination

- Want to distinguish high-confidence from marginal matches

- Need custom arithmetic expressions for scoring

- Debugging requires score breakdown details

- Score magnitudes are meaningful to your application

**When NOT to use this pattern:**

- MongoDB version < 8.2 (use $rankFusion instead)

- Simple hybrid search without score tuning needs

- Rank-based fusion is sufficient for your use case

- Performance-critical with minimal complexity needs

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/](https://mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/)

### 5.4 Tuning Hybrid Search Weights

**Impact: MEDIUM (Per-query weight tuning improves relevance by 20-40%)**

Weights control the contribution of each search method. Tune per-query based on query type.

Current MongoDB 8.2 docs describe fusion stages as Preview features, so keep weights/behavior checks in release upgrade tests.

**Incorrect: static weights for all queries**

```javascript
// WRONG: Same weights for all query types
const hybridSearch = (query) => db.products.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          vector: [{ $vectorSearch: { ... } }],
          text: [{ $search: { ... } }]
        },
        weights: {
          vector: 0.5,  // Always 50/50 - suboptimal
          text: 0.5
        }
      }
    }
  }
])
// Result: Concept queries get too much keyword weight, and vice versa
```

**Correct: dynamic weights based on query type**

```javascript
// Query type detection
function detectQueryType(query) {
  // Technical queries often have specific terms
  const technicalPatterns = /\b(error|bug|api|function|method|class|config)\b/i

  // Conceptual queries are more abstract
  const conceptualPatterns = /\b(how to|best way|explain|understand|similar to)\b/i

  // Exact match queries have quotes or very specific terms
  const exactPatterns = /"[^"]+"|\b[A-Z]{2,}\b|\d{4,}/

  if (exactPatterns.test(query)) return "exact"
  if (technicalPatterns.test(query)) return "technical"
  if (conceptualPatterns.test(query)) return "conceptual"
  return "balanced"
}

// Weight configuration by query type
const weightConfigs = {
  exact: { vector: 0.2, text: 0.8 },      // Lexical-heavy
  technical: { vector: 0.4, text: 0.6 },   // Slight lexical bias
  balanced: { vector: 0.5, text: 0.5 },    // Equal weight
  conceptual: { vector: 0.7, text: 0.3 }   // Semantic-heavy
}

// Dynamic hybrid search
async function hybridSearch(query) {
  const queryType = detectQueryType(query)
  const weights = weightConfigs[queryType]
  const queryEmbedding = await embed(query)

  return db.products.aggregate([
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [{
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 20
              }
            }],
            text: [{
              $search: {
                index: "text_index",
                text: { query: query, path: "description" }
              }
            }, { $limit: 20 }]
          },
          normalization: "none"
        },
        combination: {
          weights: weights
        }
      }
    },
    { $limit: 10 }
  ]).toArray()
}
```

**Query Type Weight Guidelines:**

| Query Type | Example | Vector | Text |

|------------|---------|--------|------|

| Exact match | "error code 404" | 0.2 | 0.8 |

| Technical | "fix authentication bug" | 0.4 | 0.6 |

| Balanced | "laptop reviews" | 0.5 | 0.5 |

| Conceptual | "how to improve performance" | 0.7 | 0.3 |

| Abstract | "similar products" | 0.8 | 0.2 |

**Using $scoreFusion for Fine Control (MongoDB 8.2+):**

```javascript
// $scoreFusion uses actual scores instead of ranks
db.products.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          vector: [{
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 20
            }
          }],
          text: [{
            $search: {
              index: "text_index",
              text: { query: searchTerm, path: "description" }
            }
          }, { $limit: 20 }]
        }
      },
      combination: {
        weights: { vector: 0.6, text: 0.4 },
        method: "avg"  // or "expression" with combination.expression
      }
    }
  },
  { $limit: 10 }
])
```

Use release notes as a guardrail during upgrades because fusion capabilities can change between minor lines.

**A/B Testing Weights:**

```javascript
// Test different weight configurations
async function testWeights(queries, weightConfigs) {
  const results = {}

  for (const [name, weights] of Object.entries(weightConfigs)) {
    let totalRelevance = 0

    for (const query of queries) {
      const searchResults = await hybridSearchWithWeights(query, weights)
      // Score based on your relevance criteria
      totalRelevance += scoreResults(searchResults, query)
    }

    results[name] = totalRelevance / queries.length
  }

  return results
}

// Example test
const testResults = await testWeights(sampleQueries, {
  "vector-heavy": { vector: 0.8, text: 0.2 },
  "balanced": { vector: 0.5, text: 0.5 },
  "text-heavy": { vector: 0.2, text: 0.8 }
})
```

**When NOT to use this pattern:**

- Single search method is sufficient

- Query classification is unreliable

- Consistent UX is more important than optimization

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/)

---

## 6. AI Agent Integration

**Impact: MEDIUM**

AI agents require memory systems to maintain context across conversations and sessions. MongoDB provides an ideal storage layer for both short-term memory (current conversation) and long-term memory (persistent knowledge). Short-term memory stores message history with embeddings for semantic retrieval of relevant past exchanges. Long-term memory stores facts, preferences, and instructions with embeddings for retrieval when contextually relevant. The schema should support filtering by userId, sessionId, memory type, and recency. Vector search enables "what did we discuss about X" queries that keyword search cannot answer. Combine TTL indexes for automatic conversation cleanup with permanent storage for critical memories. The memory retrieval pattern is identical to RAG—embed the current context and retrieve semantically relevant memories.

### 6.1 AI Agent Memory Schema Design

**Impact: MEDIUM (Proper schema enables effective memory retrieval and context management)**

AI agents need both short-term (conversation) and long-term (persistent) memory. Design schemas for each type.

**Incorrect: unstructured memory**

```javascript
// WRONG: No structure - can't filter or manage
await db.memory.insertOne({
  content: "User likes dark mode"
  // No userId, sessionId, type, embedding, or timestamps
})
// Result: Can't retrieve user-specific memories, no semantic search
```

**Correct: structured memory schemas**

```javascript
// SHORT-TERM MEMORY: Conversation context
const shortTermMemorySchema = {
  // Identifiers
  sessionId: String,       // Conversation session
  userId: String,          // User identifier
  messageId: String,       // Unique message ID

  // Content
  role: String,            // "user" | "assistant" | "system"
  content: String,         // The message text
  embedding: [Number],     // For semantic search over history

  // Context
  turnNumber: Number,      // Position in conversation
  parentMessageId: String, // For threading

  // Metadata
  createdAt: Date,
  tokenCount: Number,
  model: String
}

// LONG-TERM MEMORY: Persistent knowledge
const longTermMemorySchema = {
  // Identifiers
  memoryId: String,
  userId: String,

  // Content
  type: String,            // "fact" | "preference" | "instruction" | "episode"
  content: String,         // The memory content
  summary: String,         // Condensed version
  embedding: [Number],     // For semantic retrieval

  // Importance
  importance: Number,      // 0-1 score for prioritization
  accessCount: Number,     // How often retrieved
  lastAccessed: Date,

  // Source
  source: {
    sessionId: String,     // Where it was learned
    extractedFrom: String  // Original context
  },

  // Lifecycle
  createdAt: Date,
  expiresAt: Date,         // null for permanent
  status: String           // "active" | "archived" | "forgotten"
}

// Create both types
await db.shortTermMemory.insertOne({
  sessionId: "session_123",
  userId: "user_456",
  messageId: "msg_789",
  role: "user",
  content: "I prefer dark mode and Python code examples",
  embedding: await embed("I prefer dark mode and Python code examples"),
  turnNumber: 1,
  createdAt: new Date(),
  tokenCount: 12
})

await db.longTermMemory.insertOne({
  memoryId: "mem_001",
  userId: "user_456",
  type: "preference",
  content: "User prefers dark mode UI",
  summary: "dark mode preference",
  embedding: await embed("User prefers dark mode UI"),
  importance: 0.8,
  accessCount: 0,
  lastAccessed: null,
  source: {
    sessionId: "session_123",
    extractedFrom: "user message about preferences"
  },
  createdAt: new Date(),
  expiresAt: null,
  status: "active"
})
```

**Indexes for Memory Collections:**

```javascript
// Short-term memory index
db.shortTermMemory.createSearchIndex("stm_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    { type: "filter", path: "sessionId" },
    { type: "filter", path: "userId" },
    { type: "filter", path: "role" }
  ]
})

// TTL index for automatic cleanup
db.shortTermMemory.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 * 7 }  // 7 days
)

// Long-term memory index
db.longTermMemory.createSearchIndex("ltm_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    { type: "filter", path: "userId" },
    { type: "filter", path: "type" },
    { type: "filter", path: "status" },
    { type: "filter", path: "importance" }
  ]
})

// Index for importance-based retrieval
db.longTermMemory.createIndex({ userId: 1, importance: -1 })
```

**Memory Type Guidelines:**

| Type | Use Case | Example | Expiry |

|------|----------|---------|--------|

| `fact` | User information | "Works at Acme Corp" | Never |

| `preference` | User preferences | "Prefers Python" | Never |

| `instruction` | Custom rules | "Always use metric units" | Never |

| `episode` | Past interactions | "Helped debug auth issue" | 90 days |

**When NOT to use this pattern:**

- Simple chatbots without personalization

- Privacy-sensitive applications (implement appropriate data handling)

- Single-session interactions only

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)

### 6.2 Semantic Memory Retrieval

**Impact: MEDIUM (Enables "recall" of relevant past context for agent responses)**

Use vector search to retrieve relevant memories based on current context, not just keyword matching.

**Incorrect: keyword-based retrieval**

```javascript
// WRONG: Exact keyword match - misses semantically related memories
const memories = await db.longTermMemory.find({
  userId: currentUserId,
  content: { $regex: "Python", $options: "i" }
}).toArray()
// Result: Misses "prefers code examples in snake_case" (related but no keyword)

// WRONG: Retrieving all memories - no relevance filtering
const memories = await db.longTermMemory.find({
  userId: currentUserId
}).toArray()
// Result: Too much irrelevant context
```

**Correct: semantic retrieval**

```javascript
// Semantic memory retrieval function
async function retrieveRelevantMemories(currentContext, userId, options = {}) {
  const {
    limit = 5,
    minRelevance = 0.7,
    memoryTypes = ["fact", "preference", "instruction"]
  } = options

  // Embed the current context
  const contextEmbedding = await embed(currentContext)

  // Search long-term memory
  const memories = await db.longTermMemory.aggregate([
    {
      $vectorSearch: {
        index: "ltm_vector_index",
        path: "embedding",
        queryVector: contextEmbedding,
        numCandidates: limit * 20,
        limit: limit * 2,
        filter: {
          $and: [
            { userId: userId },
            { status: "active" },
            { type: { $in: memoryTypes } }
          ]
        }
      }
    },
    {
      $addFields: {
        relevance: { $meta: "vectorSearchScore" }
      }
    },
    {
      $match: {
        relevance: { $gte: minRelevance }
      }
    },
    {
      $sort: { relevance: -1, importance: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        type: 1,
        content: 1,
        summary: 1,
        relevance: 1,
        importance: 1
      }
    }
  ]).toArray()

  // Update access metrics
  const memoryIds = memories.map(m => m._id)
  await db.longTermMemory.updateMany(
    { _id: { $in: memoryIds } },
    {
      $inc: { accessCount: 1 },
      $set: { lastAccessed: new Date() }
    }
  )

  return memories
}

// Usage in agent
async function generateResponse(userMessage, userId, sessionId) {
  // Retrieve relevant memories
  const memories = await retrieveRelevantMemories(userMessage, userId)

  // Format memories for context
  const memoryContext = memories.map(m =>
    `[${m.type}] ${m.content}`
  ).join('\n')

  // Include in system prompt
  const systemPrompt = `You are a helpful assistant.

User Information (from memory):
${memoryContext || "No relevant memories found."}

Use this information to personalize your response.`

  return await llm.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ])
}
```

**Retrieve Conversation History:**

```javascript
// Get recent conversation for context
async function getConversationHistory(sessionId, limit = 10) {
  return await db.shortTermMemory.find({
    sessionId: sessionId
  })
  .sort({ turnNumber: -1 })
  .limit(limit)
  .toArray()
  .then(msgs => msgs.reverse())  // Chronological order
}

// Semantic search over past conversations
async function searchConversationHistory(query, userId, options = {}) {
  const { limit = 5, daysBack = 30 } = options
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)

  const queryEmbedding = await embed(query)

  return await db.shortTermMemory.aggregate([
    {
      $vectorSearch: {
        index: "stm_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: limit,
        filter: {
          userId: userId,
          createdAt: { $gte: cutoffDate }
        }
      }
    },
    {
      $project: {
        role: 1,
        content: 1,
        sessionId: 1,
        createdAt: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]).toArray()
}
```

**Combined Memory Retrieval:**

```javascript
// Retrieve from both memory types
async function getFullContext(userMessage, userId, sessionId) {
  // Parallel retrieval
  const [
    longTermMemories,
    conversationHistory,
    relatedPastConversations
  ] = await Promise.all([
    retrieveRelevantMemories(userMessage, userId, { limit: 3 }),
    getConversationHistory(sessionId, 5),
    searchConversationHistory(userMessage, userId, { limit: 2 })
  ])

  return {
    userProfile: longTermMemories,
    currentConversation: conversationHistory,
    relatedHistory: relatedPastConversations
  }
}
```

**When NOT to use this pattern:**

- Privacy requirements prohibit memory storage

- Stateless interactions required

- User requests memory deletion

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)

### 6.3 Session Context Storage

**Impact: MEDIUM (Maintains conversation continuity across interactions)**

Store and manage conversation sessions for continuity across interactions and context persistence.

**Incorrect: no session management**

```javascript
// WRONG: No session tracking
await db.messages.insertOne({
  role: "user",
  content: userMessage
  // No session, no user, no ordering
})
// Result: Can't maintain conversation continuity

// WRONG: Storing entire conversation in single document
await db.sessions.updateOne(
  { sessionId: sessionId },
  { $push: { messages: { role: "user", content: userMessage } } }
)
// Result: Document grows unbounded, hits 16MB limit
```

**Correct: session-based storage**

```javascript
// Session document (metadata only)
const sessionSchema = {
  sessionId: String,
  userId: String,

  // Session metadata
  title: String,           // Auto-generated or user-set
  createdAt: Date,
  lastActivity: Date,
  status: String,          // "active" | "archived" | "deleted"

  // Context summary
  summary: String,         // Condensed conversation context
  summaryEmbedding: [Number],

  // Statistics
  messageCount: Number,
  totalTokens: Number,

  // Settings
  model: String,
  temperature: Number
}

// Create new session
async function createSession(userId, model = "gpt-4") {
  const sessionId = generateId()

  await db.sessions.insertOne({
    sessionId,
    userId,
    title: "New Conversation",
    createdAt: new Date(),
    lastActivity: new Date(),
    status: "active",
    summary: null,
    summaryEmbedding: null,
    messageCount: 0,
    totalTokens: 0,
    model
  })

  return sessionId
}

// Add message to session
async function addMessage(sessionId, role, content) {
  const messageId = generateId()
  const embedding = await embed(content)
  const tokenCount = estimateTokens(content)

  // Get current turn number
  const lastMessage = await db.shortTermMemory
    .find({ sessionId })
    .sort({ turnNumber: -1 })
    .limit(1)
    .toArray()

  const turnNumber = (lastMessage[0]?.turnNumber || 0) + 1

  // Insert message
  await db.shortTermMemory.insertOne({
    sessionId,
    messageId,
    role,
    content,
    embedding,
    turnNumber,
    createdAt: new Date(),
    tokenCount
  })

  // Update session metadata
  await db.sessions.updateOne(
    { sessionId },
    {
      $set: { lastActivity: new Date() },
      $inc: {
        messageCount: 1,
        totalTokens: tokenCount
      }
    }
  )

  return messageId
}
```

**Session Context Retrieval:**

```javascript
// Get recent context for LLM
async function getSessionContext(sessionId, maxTokens = 4000) {
  let totalTokens = 0
  const messages = []

  // Get messages in reverse order
  const cursor = db.shortTermMemory
    .find({ sessionId })
    .sort({ turnNumber: -1 })

  for await (const msg of cursor) {
    if (totalTokens + msg.tokenCount > maxTokens) break
    messages.unshift(msg)  // Add to front for chronological order
    totalTokens += msg.tokenCount
  }

  return messages.map(m => ({
    role: m.role,
    content: m.content
  }))
}

// Resume conversation with context
async function resumeConversation(sessionId, newMessage) {
  // Get existing context
  const history = await getSessionContext(sessionId)

  // Add new message
  await addMessage(sessionId, "user", newMessage)

  // Get relevant long-term memory
  const session = await db.sessions.findOne({ sessionId })
  const memories = await retrieveRelevantMemories(newMessage, session.userId)

  // Build full context
  return {
    messages: [
      ...buildMemoryContext(memories),
      ...history,
      { role: "user", content: newMessage }
    ]
  }
}
```

**Session Summary for Long Conversations:**

```javascript
// Summarize conversation when it gets long
async function summarizeSession(sessionId) {
  const session = await db.sessions.findOne({ sessionId })

  // Only summarize if conversation is long
  if (session.messageCount < 10) return

  // Get all messages
  const messages = await db.shortTermMemory
    .find({ sessionId })
    .sort({ turnNumber: 1 })
    .toArray()

  // Generate summary via LLM
  const summaryPrompt = `Summarize this conversation in 2-3 sentences, capturing key topics and any user preferences learned:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`

  const summary = await llm.complete(summaryPrompt)
  const summaryEmbedding = await embed(summary)

  // Update session with summary
  await db.sessions.updateOne(
    { sessionId },
    {
      $set: {
        summary,
        summaryEmbedding
      }
    }
  )

  return summary
}

// Use summary for quick context
async function getQuickContext(sessionId) {
  const session = await db.sessions.findOne({ sessionId })

  if (session.summary) {
    // Use summary + recent messages
    const recentMessages = await db.shortTermMemory
      .find({ sessionId })
      .sort({ turnNumber: -1 })
      .limit(5)
      .toArray()

    return {
      summary: session.summary,
      recentMessages: recentMessages.reverse()
    }
  }

  return { recentMessages: await getSessionContext(sessionId) }
}
```

**Session Lifecycle Management:**

```javascript
// List user's sessions
async function listSessions(userId, status = "active") {
  return db.sessions
    .find({ userId, status })
    .sort({ lastActivity: -1 })
    .project({ sessionId: 1, title: 1, lastActivity: 1, messageCount: 1 })
    .toArray()
}

// Archive old sessions
async function archiveOldSessions(userId, daysOld = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  await db.sessions.updateMany(
    {
      userId,
      status: "active",
      lastActivity: { $lt: cutoff }
    },
    { $set: { status: "archived" } }
  )
}

// Delete session and messages
async function deleteSession(sessionId) {
  await db.shortTermMemory.deleteMany({ sessionId })
  await db.sessions.deleteOne({ sessionId })
}
```

**When NOT to use this pattern:**

- Ephemeral interactions (one-shot queries)

- Privacy requirements mandate no storage

- Extremely high-volume, low-value interactions

1. Run the "Correct" index or query example on a staging dataset.

2. Validate expected behavior and performance using explain and Atlas metrics.

3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)

---

## References

1. [https://mongodb.com/docs/atlas/atlas-vector-search/](https://mongodb.com/docs/atlas/atlas-vector-search/)
2. [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/)
3. [https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/)
4. [https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/](https://mongodb.com/docs/atlas/atlas-vector-search/vector-quantization/)
5. [https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/)
6. [https://mongodb.com/docs/atlas/atlas-vector-search/rag/](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)
7. [https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/](https://mongodb.com/docs/atlas/atlas-vector-search/ai-agents/)
8. [https://mongodb.com/docs/atlas/atlas-vector-search/improve-accuracy/](https://mongodb.com/docs/atlas/atlas-vector-search/improve-accuracy/)
9. [https://mongodb.com/docs/atlas/atlas-vector-search/troubleshooting/](https://mongodb.com/docs/atlas/atlas-vector-search/troubleshooting/)
