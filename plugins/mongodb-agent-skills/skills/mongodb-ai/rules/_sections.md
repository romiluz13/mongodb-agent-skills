# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Vector Index Creation (index)

**Impact:** CRITICAL
**Description:** Vector indexes are fundamentally different from traditional MongoDB indexes. They require deployment-aware syntax and parameters that AI assistants often get wrong due to knowledge cutoffs. The index definition must include `type: "vector"`, `path`, `numDimensions` that matches your embedding output, and a valid `similarity` function. Filter fields require separate `type: "filter"` definitions. Quantization, views, HNSW options, multi-tenant layouts, and automated embedding are all release-sensitive or workload-sensitive decisions that should be validated against the current docs for the target deployment.

## 2. $vectorSearch Queries (query)

**Impact:** CRITICAL
**Description:** The `$vectorSearch` aggregation stage has strict requirements that differ from standard MongoDB queries. It must be the first stage in the pipeline. Query embeddings must share the same space and dimensions as the indexed vectors. `numCandidates` is a recall/latency tuning control; the 20x rule is a starting point, not a law. Use `$vectorSearch.filter` for supported MQL metadata filters. If you need Atlas Search operator filters such as `text`, `phrase`, `wildcard`, or `geoWithin`, route the detailed wiring to `mongodb-search` and use `$search.vectorSearch` where the docs support it. Scores are retrieved with `$meta: "vectorSearchScore"`.

## 3. Performance Tuning (perf)

**Impact:** HIGH
**Description:** Vector search performance depends on HNSW behavior and workload-specific tuning. Index sizing, quantization, `numCandidates`, selective prefilters, explain output, and Search Node sizing should all be treated as benchmark-driven choices. Use the docs for current feature availability and use metrics plus explain to validate recall, latency, and cost on the target deployment.

## 4. RAG Patterns (rag)

**Impact:** HIGH
**Description:** RAG (Retrieval-Augmented Generation) is the primary use case for vector search. The pattern has three phases: Ingestion stores documents with their embeddings, Retrieval uses $vectorSearch to find semantically relevant context, Generation passes that context to the LLM. Common mistakes include: using different embedding models for ingestion and retrieval (results in zero matches), not chunking documents (large documents dilute embedding relevance), exceeding LLM context windows (wasted tokens and truncation), and not including metadata for filtering (can't narrow by date, source, or category). The retrieval phase should return scores to enable relevance thresholding. Metadata filtering during retrieval is more efficient than post-retrieval filtering.

## 5. Hybrid Search (hybrid)

**Impact:** MEDIUM
**Description:** Hybrid retrieval combines vector (semantic) search with lexical search using `$rankFusion` or `$scoreFusion`, or with retrieval followed by application-side reranking. Treat all fusion behavior as release-sensitive. This skill owns strategy choice and weighting guidance; `mongodb-search` owns exact stage legality, lexical operator composition, and deployment routing for search-engine-first hybrid pipelines.

## 6. AI Agent Integration (agent)

**Impact:** MEDIUM
**Description:** AI agents require memory systems to maintain context across conversations and sessions. MongoDB provides an ideal storage layer for both short-term memory (current conversation) and long-term memory (persistent knowledge). Short-term memory stores message history with embeddings for semantic retrieval of relevant past exchanges. Long-term memory stores facts, preferences, and instructions with embeddings for retrieval when contextually relevant. The schema should support filtering by userId, sessionId, memory type, and recency. Vector search enables "what did we discuss about X" queries that keyword search cannot answer. Combine TTL indexes for automatic conversation cleanup with permanent storage for critical memories. The memory retrieval pattern is identical to RAG—embed the current context and retrieve semantically relevant memories.
