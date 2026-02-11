# Atlas Hybrid Search Deep Delta Audit (v7.2 -> v7.2.1)

## Date

2026-02-11

## Objective

Validate whether `atlas-hybrid-search` `v7.2.1` introduces MongoDB capability changes that require updates to `mongodb-ai` skill coverage, then reconcile with latest MongoDB 8.2 docs.

## Sources

- Compare: https://github.com/JohnGUnderwood/atlas-hybrid-search/compare/v7.2...v7.2.1
- Repository: https://github.com/JohnGUnderwood/atlas-hybrid-search
- MongoDB docs:
  - https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/
  - https://www.mongodb.com/docs/manual/reference/operator/aggregation/scoreFusion/
  - https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/
  - https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/
  - https://www.mongodb.com/docs/manual/release-notes/8.2-changelog/

## Upstream Delta Forensics (v7.2 -> v7.2.1)

Observed commits:

1. `6d42a4b` - "Fix some bugs with rendering params"
2. `505e6b9` - "Bump axios in the npm_and_yarn group across 1 directory"

Changed files:

- `components/filter-fields.js`
- `components/steering.js`
- `package.json`
- `package-lock.json`

Impact classification:

- **No new MongoDB query capability added** (no new stage/operator/version gate introduced).
- **UI correctness fix**:
  - `steering.js` now correctly passes `config.params` subset to `SetParams`.
  - `filter-fields.js` wraps `TextInput` to fix layout/render behavior.
- **Dependency/security hygiene**:
  - `axios` bumped to `^1.13.5`.

Conclusion: `v7.2.1` is a patch-quality release, not a feature-surface expansion.

## 15-Parameter Capability Coverage Matrix

| # | Parameter | Upstream Evidence | MongoDB AI Skill Coverage | Status | Action |
|---|-----------|-------------------|---------------------------|--------|--------|
| 1 | Unified `$search.vectorSearch` usage | repo `lib/pipelineStages.js` | `query-lexical-prefilter.md` | Covered | None |
| 2 | Lexical prefilters (fuzzy/phrase/compound) | repo `lib/pipelineStages.js` | `query-lexical-prefilter.md` | Covered | None |
| 3 | Rank fusion stage | repo `components/rrf.js` | `hybrid-rankfusion.md` | Covered | None |
| 4 | Score fusion stage | repo `components/rsf.js` | `hybrid-scorefusion.md` | Covered | None |
| 5 | Weighted hybrid blending | repo `components/rrf.js`, `components/rsf.js` | `hybrid-weights.md` | Covered | None |
| 6 | Custom score expressions | repo `components/rsf.js`, `components/steering.js` | `hybrid-scorefusion.md` | Covered | None |
| 7 | `scoreDetails` debugging | repo `components/rrf.js`, `components/rsf.js` | `hybrid-rankfusion.md`, `hybrid-scorefusion.md` | Covered | None |
| 8 | Query-time lexical filter composition | repo `components/filter-fields.js` + `lib/pipelineStages.js` | `query-lexical-prefilter.md` | Covered | None |
| 9 | Vector prefilter fundamentals | repo vectorSearch filter paths | `query-prefiltering.md` | Covered | None |
| 10 | Score retrieval semantics | repo projects `$meta: "searchScore"` after `$search` | `query-get-scores.md` + lexical-prefilter rule distinction | Covered | None |
| 11 | Version gating (8.0/8.1/8.2) | README compatibility + fusion code | `hybrid-rankfusion.md`, `hybrid-scorefusion.md` | Covered | None |
| 12 | Fusion sub-pipeline stage allowlist | Docs + fusion usage | `hybrid-limitations.md` | **Partial -> Fixed** | Updated allowlist notes for `$skip` and rank-fusion `$sample` |
| 13 | Cross-collection fallback pattern | docs limitation + app union strategy elsewhere | `hybrid-limitations.md` (`$unionWith` alternative) | Covered | None |
| 14 | Explainability/perf analysis path | app exposes tunables; docs require explain | `perf-explain-vectorsearch.md` | Covered | None |
| 15 | Release hygiene/security patch awareness | axios bump in patch | Release process and audits | Covered | None |

## Skill Change Applied

- Updated `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/hybrid-limitations.md`:
  - Added `$skip` explicitly to allowed sub-pipeline stages.
  - Added `$sample` with rank-fusion scope note.
  - Clarified that sub-pipeline pagination control is not equivalent to stable global fused-result pagination.

## Optional Backlog (Non-Blocking)

These are useful app-level patterns in `atlas-hybrid-search` but not mandatory MongoDB docs gaps:

1. Add a dedicated rule for **feedback-driven query steering** (early/late fusion with positive/negative examples).
2. Add a dedicated rule for **external rerank after union retrieval** (second-stage model reranking).

These are roadmap candidates, not release blockers for current MongoDB AI baseline.

## Final Decision

- **Does this change anything critical?** No, not from `v7.2 -> v7.2.1`.
- **Do we need immediate feature-surface expansion?** No.
- **Did we improve precision anyway?** Yes, by tightening hybrid stage-limit documentation in one rule.
