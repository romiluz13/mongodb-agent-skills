# Version Reconciliation Addendum: MongoDB 8.2.x (Not "8.21")

## Scope Clarification

The requested version line "8.21" maps to **MongoDB 8.2.1**.

From current official release/changelog pages (checked on **February 10, 2026**):

1. `8.2.1` was released on **October 3, 2025**.
2. Latest listed patch is `8.2.5` on **February 10, 2026**.
3. MongoDB 8.2 includes all changes introduced in MongoDB 8.1.

## Why This Matters for Skill Content

Version-claim mistakes in rules can produce incorrect production guidance. All version-sensitive rules should explicitly gate behavior by `8.0`, `8.1`, and `8.2+` where required.

## Confirmed 8.2.x-Relevant Features by Skill

### MongoDB.AI

1. **Views + Search/Vector Search command support** is available starting in **8.1** (and included in 8.2 docs).
2. **`$rankFusion` on views** is explicitly called out as starting in **8.2**.
3. **`$scoreFusion`** is a **MongoDB 8.2+** stage.
4. **Fusion stages (`$rankFusion`, `$scoreFusion`)** are currently documented as **Preview features** in MongoDB 8.2 compatibility-versioned docs.
5. **Lexical prefilters** for Vector Search are documented as a preview feature in Atlas changelog (Nov 24, 2025).
6. **HNSW exposed options** are documented with bounds/defaults (`maxEdges` 16..64, default 16; `numEdgeCandidates` 100..3200, default 100).

### Query and Index Optimization

1. **`$queryStats`** is not an 8.0-only feature; 8.0 release notes describe enhancements and `queryShapeHash`, while 8.2 adds delinquency and CPU metrics.
2. **`bulkWrite` database command** is introduced in 8.0.
3. **`setQuerySettings.comment`** is available in the 8.1 line (also backported in 8.0 patch line per docs notes).

### Schema Advisor

1. **`validationAction: "errorAndLog"`** starts in the 8.1 line and is included in 8.2 docs.
2. Compatibility/downgrade caveats for `errorAndLog` remain mandatory guidance.

## Source Links (Official)

1. https://www.mongodb.com/docs/manual/release-notes/8.2/
2. https://www.mongodb.com/docs/manual/release-notes/8.2-compatibility/
3. https://www.mongodb.com/docs/manual/release-notes/8.0/
4. https://www.mongodb.com/docs/v8.2/reference/operator/aggregation/rankFusion/
5. https://www.mongodb.com/docs/v8.2/reference/operator/aggregation/scoreFusion/
6. https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog/
7. https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/
8. https://www.mongodb.com/docs/manual/reference/operator/aggregation/queryStats/

## Sprint Impact

This addendum confirms earlier Sprint fixes were necessary and remains a guardrail for ongoing release-drift checks. Current hardening work adds explicit preview-state and version-boundary enforcement in CI.
