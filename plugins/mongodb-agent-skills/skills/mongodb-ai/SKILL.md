---
name: mongodb-ai
description: MongoDB Atlas Vector Search and AI integration. Use when creating vector indexes, writing $vectorSearch queries, building RAG applications, implementing hybrid search, or storing AI agent memory. Triggers on "vector search", "vector index", "$vectorSearch", "embedding", "semantic search", "RAG", "retrieval augmented generation", "numCandidates", "similarity search", "cosine similarity", "hybrid search", "$rankFusion", "$scoreFusion", "AI agent", "LLM memory", "quantization", "multi-tenant", "Search Nodes", "explain vectorsearch", "HNSW", "automated embedding".
license: Apache-2.0
metadata:
  author: mongodb
  version: "1.2.0"
---

# MongoDB AI: Vector Search and AI Integration

Vector Search patterns and AI integration strategies for MongoDB, maintained by MongoDB. Contains **32 rules across 6 categories**, prioritized by impact. This skill bridges the critical knowledge gap where AI assistants have outdated or incorrect information about MongoDB's AI capabilities.

## Critical Warning

> **Your AI assistant's knowledge about MongoDB Vector Search is likely outdated or incorrect.**
>
> Atlas Vector Search syntax, `$vectorSearch` stage, vector index creation, and related features have evolved significantly. Do NOT trust pre-trained knowledge. Always reference these rules and verify against your actual MongoDB cluster.

## When to Apply

Reference these guidelines when:
- Creating vector indexes for semantic search
- Writing `$vectorSearch` aggregation queries
- Tuning numCandidates for recall vs. latency
- Implementing RAG (Retrieval-Augmented Generation)
- Building hybrid search with `$rankFusion` or `$scoreFusion`
- Storing AI agent memory (short-term and long-term)
- Choosing similarity functions (cosine, euclidean, dotProduct)
- Enabling vector quantization for large datasets
- Pre-filtering vector search results
- Debugging "no results" or slow vector queries

## Rule Categories by Priority

| Priority | Category | Impact | Prefix | Rules |
|----------|----------|--------|--------|-------|
| 1 | Vector Index Creation | CRITICAL | `index-` | 9 |
| 2 | $vectorSearch Queries | CRITICAL | `query-` | 6 |
| 3 | Performance Tuning | HIGH | `perf-` | 6 |
| 4 | RAG Patterns | HIGH | `rag-` | 4 |
| 5 | Hybrid Search | MEDIUM | `hybrid-` | 4 |
| 6 | AI Agent Integration | MEDIUM | `agent-` | 3 |

## Quick Reference

### 1. Vector Index Creation (CRITICAL) - 9 rules

- `index-vector-definition` - Required fields: type, path, numDimensions, similarity
- `index-similarity-function` - Choosing cosine vs euclidean vs dotProduct
- `index-filter-fields` - Pre-filtering with filter type indexes
- `index-quantization` - Scalar (3.75x) vs binary (24x) RAM reduction
- `index-dimensions-match` - numDimensions must match embedding model
- `index-multitenant` - Single collection with tenant_id for SaaS apps
- `index-views-partial` - Partial indexing via MongoDB Views
- `index-hnsw-options` - maxEdges/numEdgeCandidates tuning
- `index-automated-embedding` - Server-side embedding with Voyage AI

### 2. $vectorSearch Queries (CRITICAL) - 6 rules

- `query-vectorsearch-first` - MUST be first stage in aggregation pipeline
- `query-numcandidates-tuning` - The 20x rule for recall vs latency
- `query-ann-vs-enn` - When to use exact: true
- `query-prefiltering` - Filter before vector comparison
- `query-get-scores` - Using $meta: "vectorSearchScore"
- `query-same-embedding-model` - Data and query embeddings must match

### 3. Performance Tuning (HIGH) - 6 rules

- `perf-quantization-scale` - Enable at 100K+ vectors
- `perf-index-in-memory` - Vector indexes must fit in RAM
- `perf-numcandidates-tradeoff` - Higher = better recall, slower queries
- `perf-prefilter-narrow` - Reduce candidate set before vector comparison
- `perf-explain-vectorsearch` - Debug with explain() for vector queries
- `perf-search-nodes` - Dedicated Search Nodes for production

### 4. RAG Patterns (HIGH) - 4 rules

- `rag-ingestion-pattern` - Store documents with embeddings
- `rag-retrieval-pattern` - $vectorSearch for context retrieval
- `rag-context-window` - Managing LLM context limits
- `rag-metadata-filtering` - Filter by source, date, category

### 5. Hybrid Search (MEDIUM) - 4 rules

- `hybrid-rankfusion` - Combining vector + text search (MongoDB 8.0+)
- `hybrid-scorefusion` - Score-based hybrid search (MongoDB 8.2+)
- `hybrid-weights` - Per-query weight tuning
- `hybrid-limitations` - Stage restrictions in sub-pipelines

### 6. AI Agent Integration (MEDIUM) - 3 rules

- `agent-memory-schema` - Short-term vs long-term memory design
- `agent-memory-retrieval` - Semantic search over memories
- `agent-session-context` - Conversation history storage

## Key Syntax Reference

### Vector Index Definition

```javascript
db.collection.createSearchIndex(
  "vector_index",
  "vectorSearch",
  {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: 1536,      // Must match your embedding model
        similarity: "cosine"      // or "euclidean" or "dotProduct"
      },
      {
        type: "filter",           // For pre-filtering
        path: "category"
      }
    ]
  }
)
```

### $vectorSearch Query

```javascript
db.collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [0.1, 0.2, ...],  // Your query embedding
      numCandidates: 200,             // 20x limit recommended
      limit: 10,
      filter: { category: "tech" }    // Optional pre-filter
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

## The 20x Rule (numCandidates)

```
numCandidates = 20 × limit (minimum recommended)
```

| limit | numCandidates | Max allowed |
|-------|---------------|-------------|
| 10 | 200 | 10,000 |
| 50 | 1,000 | 10,000 |
| 100 | 2,000 | 10,000 |

Higher numCandidates = better recall, slower queries.

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/index-vector-definition.md
rules/query-vectorsearch-first.md
rules/query-numcandidates-tuning.md
rules/_sections.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- "When NOT to use" exceptions
- How to verify
- Performance impact

---

## MongoDB MCP Integration

For automatic verification, connect the [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server):

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server", "--readOnly"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://user:pass@cluster.mongodb.net/mydb"
      }
    }
  }
}
```

When connected, I can automatically:
- Check existing vector indexes via `mcp__mongodb__collection-indexes`
- Analyze query performance via `mcp__mongodb__explain`
- Verify data patterns via `mcp__mongodb__aggregate`

## Action Policy

**I will NEVER execute write operations without your explicit approval.**

| Operation Type | MCP Tools | Action |
|---------------|-----------|--------|
| **Read (Safe)** | `find`, `aggregate`, `explain`, `collection-indexes` | May run automatically to verify |
| **Write (Requires Approval)** | `create-index`, `insert-many` | Show command and wait for approval |

---

## Common Errors

### "$vectorSearch is not allowed"
**Cause**: MongoDB version < 7.0.2
**Fix**: Upgrade cluster to MongoDB 7.0.2+

### No results returned
**Causes**:
1. Different embedding model for data vs query
2. Index still building
3. Mismatched field path or index name

### "Path 'field' needs to be indexed as token"
**Cause**: Filter field not indexed with `type: "filter"`
**Fix**: Add filter field to index definition

---

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
