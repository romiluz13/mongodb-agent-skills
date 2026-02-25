# MongoDB Search Docs Navigation

Use this map to route quickly to canonical docs before writing or editing rules.

## Release Gate Check (Always First)

1. Check Atlas Search changelog: https://www.mongodb.com/docs/atlas/atlas-search/changelog.md
2. Check Atlas Vector Search changelog: https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog.md
3. If feature status is unclear, label guidance as unknown and request version details.

## Deployment Routing

- Atlas Search deployment options: https://www.mongodb.com/docs/atlas/atlas-search/about/deployment-options.md
- Atlas Search feature compatibility: https://www.mongodb.com/docs/atlas/atlas-search/about/feature-compatibility.md
- Install Community + Search: https://www.mongodb.com/docs/manual/administration/install-community.md
- Connect Community Search: https://www.mongodb.com/docs/manual/core/search-in-community/connect-to-search.md
- Community replica set/keyfile setup: https://www.mongodb.com/docs/manual/core/search-in-community/deploy-rs-keyfile-mongot.md
- Verify `mongot` packages and integrity: https://www.mongodb.com/docs/manual/core/search-in-community/verify-mongot-packages.md
- Kubernetes Search deployment architecture: https://www.mongodb.com/docs/kubernetes/current/fts-vs-deployment.md
- Kubernetes MongoDBSearch settings: https://www.mongodb.com/docs/kubernetes/current/reference/fts-vs-settings.md

## Index and Mapping Design

- Define field mappings: https://www.mongodb.com/docs/atlas/atlas-search/define-field-mappings.md
- Custom analyzers: https://www.mongodb.com/docs/atlas/atlas-search/analyzers/custom.md
- Synonyms: https://www.mongodb.com/docs/atlas/atlas-search/synonyms.md
- Autocomplete field type: https://www.mongodb.com/docs/atlas/atlas-search/field-types/autocomplete-type.md
- Facet collector and field types: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/facet.md

## Query Composition and Relevance

- Query reference: https://www.mongodb.com/docs/atlas/atlas-search/query-ref.md
- Compound operator: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/compound.md
- Text operator: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/text.md
- Phrase operator: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/phrase.md
- Autocomplete operator: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/autocomplete.md
- QueryString operator: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/queryString.md
- Highlighting: https://www.mongodb.com/docs/atlas/atlas-search/highlighting.md
- Return stored source: https://www.mongodb.com/docs/atlas/atlas-search/return-stored-source.md
- Return scope: https://www.mongodb.com/docs/atlas/atlas-search/return-scope.md
- `$searchMeta`: https://www.mongodb.com/docs/atlas/atlas-search/aggregation-stages/searchMeta.md

## Hybrid, Fusion, and Interop

- Hybrid Search guide: https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search.md
- `$vectorSearch` stage: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage.md
- `vectorSearch` operator in `$search`: https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch.md
- `$rankFusion`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion.md
- `$scoreFusion`: https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion.md

## Operations and Troubleshooting

- Manage search indexes: https://www.mongodb.com/docs/atlas/atlas-search/manage-indexes.md
- Search explain: https://www.mongodb.com/docs/atlas/atlas-search/explain.md
- Search monitoring: https://www.mongodb.com/docs/atlas/atlas-search/monitoring.md
- Alert conditions: https://www.mongodb.com/docs/atlas/reference/alert-conditions.md
- Search alert resolutions: https://www.mongodb.com/docs/atlas/reference/alert-resolutions/atlas-search-alerts.md
- Search metrics: https://www.mongodb.com/docs/atlas/review-atlas-search-metrics.md

## Boundary Handoff to `mongodb-ai`

Use `mongodb-ai` when requests focus on model/provider behavior and RAG semantics:

- Automated embeddings: https://www.mongodb.com/docs/atlas/atlas-vector-search/crud-embeddings/create-embeddings-automatic.md
- Voyage model docs: https://www.mongodb.com/docs/voyageai/models/text-embeddings.md
