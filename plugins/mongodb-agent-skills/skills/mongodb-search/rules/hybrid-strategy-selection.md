---
title: Choose Hybrid Strategy by Goal and Constraints
impact: HIGH
impactDescription: Improves ranking quality and cost control for hybrid retrieval
tags: hybrid, rerank, weights, strategy
---

## Choose Hybrid Strategy by Goal and Constraints

**Impact: HIGH (wrong strategy leads to low relevance or excessive cost)**

Use fusion-only when in-database ranking is sufficient. Use retrieval plus rerank when top-k precision is critical. Tune lexical/vector weights per query family, not globally.

**Incorrect (one static strategy for all workloads):**

```text
"Always use equal weights and never rerank."
```

**Correct (goal-based strategy matrix):**

```text
- Fusion-only: broad discovery, lower complexity.
- Retrieval + rerank: precision-sensitive ranking.
- Adjust lexical/vector weights by intent class.
- Add per-subpipeline limits to control compute.
```

**How to verify:**

- Offline relevance evaluation compares strategy variants.
- Latency, cost, and quality are tracked together.

**When NOT to use this pattern:**

- You only run lexical or only run semantic retrieval.

Reference: [Hybrid Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search.md)
Reference: [$rankFusion](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion.md)
Reference: [$scoreFusion](https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion.md)
