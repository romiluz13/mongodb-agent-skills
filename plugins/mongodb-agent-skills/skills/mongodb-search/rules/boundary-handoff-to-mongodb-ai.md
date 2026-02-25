---
title: Hand Off Provider and Embedding Semantics to mongodb-ai
impact: MEDIUM
impactDescription: Prevents duplicated or conflicting model-level guidance
tags: boundary, mongodb-ai, voyage, auto-embedding, rag
---

## Hand Off Provider and Embedding Semantics to mongodb-ai

**Impact: MEDIUM (boundary drift creates contradictory guidance across skills)**

Keep `mongodb-search` focused on search engine semantics. If the task depends on embedding provider details (model compatibility, `input_type`, chunking, RAG memory patterns), hand off to `mongodb-ai`.

**Incorrect (duplicating model/provider guidance here):**

```text
"In this Search rule, always use provider X model Y with input_type=query and chunk size Z."
```

**Correct (explicit handoff):**

```text
This rule owns search engine behavior.
For provider/model semantics (Voyage model selection, input_type, auto-embedding model strategy), use mongodb-ai.
```

**How to verify:**

- Search rules reference `mongodb-ai` for provider/model details.
- No duplicate model compatibility matrices are maintained in this skill.

**When NOT to use this pattern:**

- The request is purely search engine syntax and does not involve model semantics.

Reference: [Automated Embeddings](https://www.mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic.md)
Reference: [Voyage Text Embeddings](https://www.mongodb.com/docs/voyageai/models/text-embeddings.md)
