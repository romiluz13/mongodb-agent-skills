# Sprint 2 Execution Log (Completed)

- **Sprint:** 2
- **Date:** 2026-02-10
- **Goal:** Close 8.1/8.2 feature-completeness and syntax-correctness gaps.

## Implemented Fixes

1. `FIX-006` / `FIX-007` in `plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/rules/perf-query-settings.md`
   - Added explicit `setQuerySettings.comment` availability note (**8.1 and 8.0.4+**).
   - Added migration guidance from deprecated index filters to query settings.

2. `FIX-008` / `FIX-023` in `plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/rules/perf-query-stats.md`
   - Added explicit 8.1 coverage note for `count` and `distinct` query shapes.
   - Added 8.2 metrics guidance for ticket delinquency and `cpuNanos` (Linux-only).

3. `FIX-009` in `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/query-vectorsearch-first.md`
   - Added `\$unionWith` nuance (MongoDB 8.0+) with stage-order constraints preserved per pipeline.

4. `FIX-010` / `FIX-022` in `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/hybrid-rankfusion.md`
   - Added version-gating clarity:
     - `\$rankFusion` stage: 8.0+
     - `\$vectorSearch` in `\$rankFusion` input pipelines: 8.1+
     - `\$rankFusion` on views: 8.2+

5. `FIX-011` in `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/hybrid-weights.md`
   - Corrected fusion syntax:
     - `\$rankFusion` weights under `combination.weights`.
     - `\$scoreFusion` combination uses `combination.weights` + `combination.method`.

6. `FIX-012` in vector index rules:
   - `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-vector-definition.md`
   - `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-dimensions-match.md`
   - Added explicit `numDimensions` boundary guidance (up to `8192`) and out-of-range example.

7. Schema rollout hardening for downgrade compatibility:
   - `plugins/mongodb-agent-skills/skills/mongodb-schema-design/rules/validation-action-levels.md`
   - `plugins/mongodb-agent-skills/skills/mongodb-schema-design/rules/validation-rollout-strategy.md`
   - Added explicit `errorAndLog` downgrade caveat and rollback command pattern via `collMod`.

## Validation Evidence

Command run:

```bash
pnpm --dir packages/mongodb-skills-build validate
```

Result:

- `mongodb-ai`: 33 rules validated
- `mongodb-query-and-index-optimize`: 46 rules validated
- `mongodb-schema-design`: 30 rules validated
- **Total:** 109 rules validated, no failures

## Outcome

Sprint 2 exit criteria met:

1. 8.1/8.2 version-gated guidance added to impacted rules.
2. Fusion examples aligned to documented stage syntax.
3. Validator remains fully green after all changes.
