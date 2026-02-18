# MongoDB AI Docs Navigation

Use this map when a rule depends on version gates, preview behavior, or provider-model details.

## Fast Routing

| Question | Source |
|---|---|
| How do I define vector/autoEmbed indexes correctly? | [Atlas Vector Search Type](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/) |
| What fields/operators does `$vectorSearch` support right now? | [Atlas `$vectorSearch` Stage](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/) |
| What are current hybrid constraints? | [Atlas Hybrid Search](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/) |
| Can I use `$vectorSearch` inside `$rankFusion`? | [Vector Search with `$rankFusion`](https://mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/vector-search-with-rankfusion/) |
| What versions support `$rankFusion` / `$scoreFusion`? | [MongoDB `$rankFusion`](https://mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/) and [MongoDB `$scoreFusion`](https://mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/) |
| How do Voyage `input_type` and model semantics work? | [Voyage Quickstart](https://mongodb.com/docs/voyageai/quickstart/) and [Voyage Text Embeddings](https://mongodb.com/docs/voyageai/models/text-embeddings/) |
| What about rerank models and usage? | [Voyage Rerankers](https://mongodb.com/docs/voyageai/models/rerankers/) |
| What changed recently in Vector Search? | [Atlas Vector Search Changelog](https://mongodb.com/docs/atlas/atlas-vector-search/changelog/) |

## Release-Gate Verification Flow

1. Confirm target server version and deployment type (Atlas vs self-managed).
2. Check stage/operator availability in the canonical docs above.
3. Check preview/private-preview disclaimers before defaulting patterns.
4. Re-run smoke examples on staging after version upgrades.

## Practical Rule

If docs and external examples disagree, treat official MongoDB docs as canonical and external repos as pattern inspiration only.
