# MongoDB AI Docs Navigation

Use this map when a rule depends on version gates, preview behavior, or provider-model details.

## Fast Routing

| Question | Source |
|---|---|
| How do I define vector/autoEmbed indexes correctly? | [Atlas Vector Search Type](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type.md) |
| What fields/operators does `$vectorSearch` support right now? | [Atlas `$vectorSearch` Stage](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage.md) |
| What are current hybrid constraints? | [Atlas Hybrid Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search.md) |
| Can I use `$vectorSearch` inside `$rankFusion`? | [Vector Search with `$rankFusion`](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/vector-search-with-rankfusion.md) |
| What versions support `$rankFusion` / `$scoreFusion`? | [MongoDB `$rankFusion`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion.md) and [MongoDB `$scoreFusion`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion.md) |
| How do Voyage `input_type` and model semantics work? | [Voyage Quickstart](https://www.mongodb.com/docs/voyageai/quickstart.md) and [Voyage Text Embeddings](https://www.mongodb.com/docs/voyageai/models/text-embeddings.md) |
| What about rerank models and usage? | [Voyage Rerankers](https://www.mongodb.com/docs/voyageai/models/rerankers.md) |
| What changed recently in Vector Search? | [Atlas Vector Search Changelog](https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog.md) |

## Release-Gate Verification Flow

1. Confirm target server version and deployment type (Atlas vs self-managed).
2. Check stage/operator availability in the canonical docs above.
3. Check preview/private-preview disclaimers before defaulting patterns.
4. Re-run smoke examples on staging after version upgrades.

## Practical Rule

If docs and external examples disagree, treat official MongoDB docs as canonical and external repos as pattern inspiration only.
