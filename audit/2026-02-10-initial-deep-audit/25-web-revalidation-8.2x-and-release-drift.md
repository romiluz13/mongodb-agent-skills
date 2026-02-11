# Web Revalidation: MongoDB 8.2.x and Release Drift (2026-02-10)

## Purpose

Re-verify version-sensitive claims after stakeholder request to double-check "MongoDB 8.21" coverage and ensure no missed capabilities for:

1. MongoDB.AI
2. Query and Index Optimization
3. Schema Advisor

## Scope and Method

1. Queried official MongoDB docs pages for release notes/changelog and feature references.
2. Cross-checked claims already present in rules.
3. Applied targeted wording updates where maturity/stability caveats were under-specified.

## Confirmed Version Facts

1. "8.21" corresponds to **MongoDB 8.2.1** in the 8.2 patch line.
2. The 8.2 changelog currently lists newer patches in the same family (including **8.2.5**).
3. Hybrid/search capabilities remain version-gated and should be treated as release-sensitive.
4. Compatibility-versioned MongoDB 8.2 stage docs currently classify fusion stages as **Preview** features.

## Confirmed Feature Alignment

### MongoDB.AI

1. Lexical prefilters via Atlas Search `vectorSearch` operator remain documented in Atlas Vector Search changelog/docs.
2. `\$rankFusion` baseline: 8.0+, with important boundary notes around vector-search pipelines and views in later versions.
3. `\$scoreFusion`: 8.2+ with score-based fusion semantics.
4. View-related fusion/query boundaries are still version-sensitive and must stay explicit.

### Query and Index Optimization

1. `\$queryStats` coverage remains broader than 8.0-only framing; 8.1 and 8.2 lines add behavior/metric changes.
2. `setQuerySettings.comment` availability remains tied to 8.1 and 8.0.4+ docs guidance.
3. Diagnostics payload for `\$queryStats` should be treated as release-sensitive output.

### Schema Advisor

1. `validationAction: "errorAndLog"` remains 8.1+ and compatibility-sensitive for downgrade workflows.

## Sprint 4 Adjustments Triggered by Revalidation

1. Added release-sensitivity caveat text to fusion rules:
   - `hybrid-rankfusion.md`
   - `hybrid-scorefusion.md`
   - `hybrid-limitations.md`
   - `hybrid-weights.md`
2. Added explicit `\$queryStats` output stability caveat in `perf-query-stats.md`.

## Residual Risks

1. Rapid/preview documentation wording can shift between patch cycles.
2. Fusion-stage docs across product surfaces (Atlas vs Manual) may differ in phrasing; maintain version-gated wording and periodic revalidation.

## Evidence

See `data/web_sources_2026-02-10_refresh.csv` for links and key claim mapping.
