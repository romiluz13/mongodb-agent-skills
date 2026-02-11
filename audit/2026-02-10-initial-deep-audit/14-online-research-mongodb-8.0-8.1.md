# Online Research Addendum: MongoDB 8.0 -> 8.1 (and Related AI/Search Updates, with 8.2.x follow-up)

- **Audit date:** February 10, 2026
- **Purpose:** Validate latest MongoDB features relevant to `mongodb-ai`, `mongodb-query-and-index-optimize`, and `mongodb-schema-design` using official MongoDB sources.
- **Method:**
  1. Pulled latest local mirrors (`vercel-labs/agent-skills`, `mongodb/docs`)
  2. Performed live web checks on official MongoDB docs pages
  3. Mapped confirmed features to current skill-rule coverage

## Reference Repos Pulled (Live)

1. `referance/agent-skills`
   - Remote: `https://github.com/vercel-labs/agent-skills`
   - Branch: `main`
   - Result: already up to date
   - HEAD: `e23951b8cad2f4b1e7e176c5731127c1263fe86f`

2. `referance/mongodb-docs`
   - Remote: `https://github.com/mongodb/docs`
   - Branch: `main`
   - Result: fast-forwarded
   - Previous HEAD: `a2dc8864d5122e858463f9d4ca39e58041c96c12`
  - Current HEAD: `a27fd678abd2dcb2489a3d31783bbe166bf1ca84`

## Confirmed MongoDB AI/Search Timeline (Official)

1. **August 26, 2024**: `$vectorSearch` usable in `$unionWith` pipelines starting with MongoDB 8.0.
   - Source: `https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/`
   - Corroborated in manual stage doc: `https://www.mongodb.com/docs/manual/reference/operator/aggregation/vectorSearch/`

2. **March 30, 2025**: Vector dimension limit increased to **8192**.
   - Source: `https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog/`

3. **June 25, 2025**: MongoDB **8.1** adds support for creating search/vector indexes on views and running `$vectorSearch` against compatible standard views.
   - Source: `https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog/`

4. **November 24, 2025**: Public preview for lexical prefilters with `vectorSearch` operator inside `$search`.
   - Source: `https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog/`
   - Operator reference: `https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/`

5. **Hybrid Search stage support baseline**:
   - `$rankFusion`: MongoDB 8.0+
   - `$scoreFusion`: MongoDB 8.2+
   - Source: `https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/`
   - Source: `https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/`

6. **`$rankFusion` + `$vectorSearch` in input pipelines**: explicitly documented as starting in v8.1 in Atlas hybrid tutorial.
   - Source: `https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/vector-search-with-rankfusion/`

## Confirmed MongoDB Server 8.0/8.1 Changes Relevant to Skills

1. **MongoDB 8.0**: Query Settings introduced (`setQuerySettings`, `removeQuerySettings`, `$querySettings`).
   - Source: `https://www.mongodb.com/docs/manual/release-notes/8.0/`

2. **MongoDB 8.0**: `updateOne` / `replaceOne` gain `sort` option.
   - Source: `https://www.mongodb.com/docs/manual/release-notes/8.0/`

3. **MongoDB 8.0**: database-level `bulkWrite` command added.
   - Source: `https://www.mongodb.com/docs/manual/release-notes/8.0/`
   - Command definition (no cross-collection atomicity guarantee claim):
     `https://www.mongodb.com/docs/manual/reference/command/bulkWrite/`

4. **MongoDB 8.1 compatibility note**: `$queryStats` output includes `count` and `distinct` query shapes.
   - Source: `https://www.mongodb.com/docs/manual/release-notes/8.1-compatibility/`

5. **MongoDB 8.1 (and 8.0.4) enhancement**: `setQuerySettings.comment` available.
   - Source: `https://www.mongodb.com/docs/manual/reference/command/setQuerySettings/`
   - Source: `https://www.mongodb.com/docs/manual/reference/operator/aggregation/querySettings/`

6. **MongoDB 8.1**: `validationAction: "errorAndLog"` introduced with downgrade caveat.
   - Source: `https://www.mongodb.com/docs/manual/core/schema-validation/handle-invalid-documents/`
   - Compatibility caveat source: `https://www.mongodb.com/docs/manual/release-notes/8.1-compatibility/`

## Parameter-Level Clarifications (Atlas Vector Index)

From official Atlas docs, current HNSW option bounds are:

- `maxEdges`: **16..64**, default **16**
- `numEdgeCandidates`: **100..3200**, default **100**

Source:
- `https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/`

## Notes on Source Reconciliation

1. MongoDB docs are split across Manual and Atlas documentation sets; some advanced AI/search behavior is described in Atlas docs/changelogs first.
2. Where Manual and Atlas wording differ in granularity, this audit treats the latest official Atlas vector/search pages as source-of-truth for Atlas Vector Search behavior.
3. Inferences in later remediation planning are explicitly labeled as inferences when they combine multiple official sources.
