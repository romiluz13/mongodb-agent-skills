# MongoDB AI Skill

MongoDB Vector Search and AI integration patterns for AI agents and developers across Atlas clusters, self-managed deployments, and local Atlas deployments created with Atlas CLI.

## Why This Skill Exists

AI assistants (Claude, GPT, etc.) have knowledge cutoffs and lack accurate information about MongoDB's newer AI capabilities:

- **MongoDB Vector Search** syntax and configuration
- **$vectorSearch** aggregation stage
- **numCandidates** tuning (the 20x rule)
- **Vector Quantization** (scalar/binary)
- **Hybrid Search** with $rankFusion
- **Hybrid strategy selection** ($rankFusion vs $scoreFusion vs retrieval+rerank)
- **RAG implementation** patterns
- **AI Agent memory** storage

This skill bridges that knowledge gap with accurate, up-to-date guidance.

If the request is mainly lexical Search engine work (`$search`, analyzers, synonyms, facets, Search alerts, or Community `mongot` setup), use `mongodb-search`.

## Installation

### Claude Code plugin
Use the root install flow in `/README.md` to install from Claude Code plugin marketplace.

### Agent Skills CLI (recommended)
```bash
npx skills add romiluz13/mongodb-agent-skills --skill mongodb-ai -a claude-code -a codex -a cursor
```

### Claude.ai
Add the skill to project knowledge or paste `SKILL.md` contents into the conversation.

## What's Included

### 33 Rules Across 6 Categories

| Category | Impact | Rules |
|----------|--------|-------|
| Vector Index Creation | CRITICAL | 9 |
| $vectorSearch Queries | CRITICAL | 7 |
| Performance Tuning | HIGH | 6 |
| RAG Patterns | HIGH | 4 |
| Hybrid Search | MEDIUM | 4 |
| AI Agent Integration | MEDIUM | 3 |

### Key Topics

- Vector index definition (type, path, numDimensions, similarity)
- Similarity function selection (cosine vs euclidean vs dotProduct)
- Filter field indexing for pre-filtering
- Vector quantization for scale with docs-backed memory/quality trade-offs
- $vectorSearch syntax and constraints
- numCandidates tuning (the 20x rule)
- ANN vs ENN search selection
- Pre-filtering vs post-filtering
- Score retrieval with $meta
- Voyage-compatible asymmetric retrieval + `input_type` guardrails
- Benchmark workflow for model/recall/latency/cost decisions
- RAG ingestion, retrieval, and context management
- Hybrid search with $rankFusion
- AI agent memory schemas

### Docs Quick Map

When behavior is release-sensitive, verify in official docs first:

- [Atlas Vector Search Stage](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage.md)
- [Atlas Vector Search Type](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type.md)
- [Atlas Hybrid Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search.md)
- [MongoDB `$rankFusion`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion.md)
- [MongoDB `$scoreFusion`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion.md)
- [Voyage Quickstart](https://www.mongodb.com/docs/voyageai/quickstart.md)
- [Voyage Text Embeddings](https://www.mongodb.com/docs/voyageai/models/text-embeddings.md)

## Usage

When you're working on MongoDB AI features, the skill triggers automatically on keywords like:
- "vector search", "vector index"
- "$vectorSearch", "embedding"
- "semantic search", "RAG"
- "numCandidates", "similarity"
- "hybrid search", "$rankFusion", "$scoreFusion"
- "rerank", "two-stage retrieval"
- "Voyage AI", "input_type", "asymmetric retrieval"
- "AI agent", "LLM memory"

## MCP Integration

For automatic verification, connect the MongoDB MCP Server:

```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server", "--readOnly"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "your-connection-string"
      }
    }
  }
}
```

## Files

```
mongodb-ai/
  SKILL.md           # Main skill definition
  AGENTS.md          # Full compiled guide
  metadata.json      # Skill metadata
  README.md          # This file
  references/
    docs-navigation.md # Docs routing + release-gate verification map
  rules/
    _sections.md     # Section definitions
    index-*.md       # Vector index rules
    query-*.md       # $vectorSearch rules
    perf-*.md        # Performance rules
    rag-*.md         # RAG pattern rules
    hybrid-*.md      # Hybrid search rules
    agent-*.md       # AI agent rules
```

## License

Apache-2.0

## Contributing

Issues and PRs welcome at the main repository.
