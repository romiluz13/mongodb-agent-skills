# Remediation Roadmap and Backlog

## Phase 1 (Immediate, 1-2 days)

1. Fix P0 factual errors:
   - `perf-query-stats.md`
   - `query-bulkwrite-command.md`
   - `index-hnsw-options.md`
   - `index-views-partial.md`
2. Repair broken reference links.
3. Add `Incorrect/Correct` example labels where validator currently fails.

## Phase 2 (Short term, 3-5 days)

1. Add full build support for `mongodb-ai` in build scripts/config.
2. Add all-skill build orchestration (`--all` pattern).
3. Regenerate and synchronize all `AGENTS.md` artifacts.
4. Add `Verify with` sections for AI rules (priority order: index/query/perf first).

## Phase 3 (Hardening, 1-2 weeks)

1. Add CI gates from `12-validation-and-release-gates.md`.
2. Introduce periodic docs-sync audit for version-sensitive rules.
3. Expand docs traceability matrix to every rule (not only high-risk subset).

## Backlog Items (Trackable)

- `AUD-001`: Correct `$queryStats` version + reset guidance language.
- `AUD-002`: Reword `bulkWrite` atomicity claim with transaction-safe framing.
- `AUD-003`: Correct HNSW defaults/ranges table.
- `AUD-004`: Correct view query behavior by MongoDB version.
- `AUD-005`: Add AI to build/extract scripts.
- `AUD-006`: Implement multi-skill `--all` build command.
- `AUD-007`: Eliminate `AGENTS.md` version/rule-count drift.
- `AUD-008`: Add `Verify with` sections to 33 AI rules.
- `AUD-009`: Add URL health check CI step.
- `AUD-010`: Add docs-evidence assertion step for sensitive claims.

## Definition of Done

- All P0/P1 items closed.
- `pnpm validate` passes.
- Reference health is clean.
- All three skills compile and sync deterministically.
- Audit score threshold: each skill >=65/75.
