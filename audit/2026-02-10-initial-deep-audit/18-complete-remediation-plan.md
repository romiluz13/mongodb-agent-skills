# Complete Remediation Plan (Post-Research, 8.0 -> 8.2.x)

## Objective

Deliver a fully accurate, build-validated, and maintainable MongoDB skills suite across:

1. `Schema Advisor` (`mongodb-schema-design`)
2. `Query and Index Optimization` (`mongodb-query-and-index-optimize`)
3. `MongoDB.AI` (`mongodb-ai`)

This plan prioritizes factual correctness first, then build parity, then long-term quality automation.

## Remediation Parameters (15)

Each parameter below must pass before final signoff.

1. **Version Accuracy**
   - Every version-gated claim (`8.0`, `8.1`, `8.2+`) must match official docs.
2. **Feature Completeness (8.0 -> 8.2.x scope)**
   - New capabilities requested by stakeholders are represented or explicitly deferred.
3. **Syntax Correctness**
   - All code snippets use valid command/stage structure for stated server version.
4. **Behavioral Correctness**
   - Claims around atomicity, ordering, limitations, and performance are doc-aligned.
5. **Reference Integrity**
   - All rule reference URLs resolve (HTTP 200).
6. **Rule Structure Compliance**
   - Validator requirements (good/bad examples, parseability) pass.
7. **Build Parity Across Skills**
   - Build/extract/compile tooling includes all three skills (including `mongodb-ai`).
8. **Compiled Artifact Synchronization**
   - `AGENTS.md` outputs regenerate deterministically from rule sources.
9. **Traceability to Source-of-Truth Docs**
   - High-risk claims map to explicit doc pages.
10. **Operational Safety Guidance**
   - Rollout caveats (e.g., `errorAndLog` downgrade limits) are documented.
11. **Compatibility Boundaries**
   - Rules state fallback behavior for pre-required versions.
12. **Example Executability Heuristic**
   - Snippets are internally consistent and runnable with minimal adaptation.
13. **Cross-Rule Consistency**
   - No conflicting guidance between related rules.
14. **Release Gating**
   - Pre-merge checks enforce build/validate/link health.
15. **Drift Monitoring**
   - Scheduled docs-refresh audit process exists for version-sensitive rules.

## Execution Waves

## Wave 0: Lock Baseline (0.5 day)

1. Freeze current findings and source snapshots.
2. Record pulled commit SHAs for references.
3. Create a task board from `data/remediation_master_tasks.csv`.

**Exit criteria:** immutable baseline recorded.

## Wave 1: P0 Factual Corrections (1-2 days)

1. Fix `perf-query-stats.md`:
   - Correct version framing.
   - Remove/replace invalid reset guidance.
   - Add 8.1 `count`/`distinct` compatibility note.
2. Fix `query-bulkwrite-command.md`:
   - Remove “atomic across collections” claim.
   - Add explicit transaction guidance for atomic multi-collection workflows.
3. Fix `index-hnsw-options.md`:
   - Set official bounds/defaults (`maxEdges` 16..64, default 16; `numEdgeCandidates` 100..3200, default 100).
4. Fix `index-views-partial.md`:
   - Correct view support version boundary to 8.1 where applicable.

**Exit criteria:** all P0 findings closed and peer-reviewed.

## Wave 2: 8.1/8.2 Feature Coverage + Syntax Hygiene (1-2 days)

1. MongoDB.AI updates:
   - Add `$unionWith` nuance to `query-vectorsearch-first.md`.
   - Add 8.1 gating note for `$rankFusion` + `$vectorSearch` input pipeline scenario.
   - Add 8.2 note: `$rankFusion` support on views.
   - Fix invalid `$scoreFusion` example structure in `hybrid-weights.md`.
   - Add explicit 8.2+ gate wherever `$scoreFusion` is referenced.
   - Add explicit 8192 dimension ceiling note.
2. Query/index updates:
   - Add `setQuerySettings.comment` (8.1 / 8.0.4) in `perf-query-settings.md`.
   - Add index-filter deprecation migration note.
   - Add 8.2 `$queryStats` metric notes (`cpuNanos`, delinquency metrics) where relevant.
3. Schema updates:
   - Add explicit `errorAndLog` downgrade caveat in validation rollout docs.

**Exit criteria:** no remaining 8.0/8.1 coverage gaps in matrices.

## Wave 3: Validation and Build Parity (1 day)

1. Fix validator blocker in `perf-query-plan-cache.md` by adding labeled incorrect/correct examples.
2. Bring `mongodb-ai` into build scripts:
   - `build-agents`, `extract-tests`, and related config/display mappings.
3. Regenerate `AGENTS.md` for all skills.

**Exit criteria:**

1. `pnpm --dir packages/mongodb-skills-build validate` passes.
2. Build outputs are deterministic and include `mongodb-ai`.

## Wave 4: Reference Health + CI Gates (1 day)

1. Replace broken URLs:
   - `cluster-tier-overview` link in `perf-index-in-memory.md`
   - generic query-operator directory link in `query-avoid-ne-nin.md`
2. Add CI checks:
   - validate rules
   - build all skills
   - URL health check for references

**Exit criteria:** URL check green, CI gate green.

## Wave 5: Hardening and Long-Term Operations (1-2 days)

1. Add docs traceability metadata for all high-risk rules.
2. Introduce periodic doc-sync audit cadence (monthly or per release event).
3. Define change-management checklist for new MongoDB release deltas.

**Exit criteria:** drift-monitoring process documented and scheduled.

## Acceptance Tests (Release Gate)

1. `pnpm --dir /Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build validate`
2. Build all three skills without manual patching.
3. Confirm no reference URL returns 404.
4. Manual spot-check of updated rules against source docs (at least one per critical capability).
5. Confirm all P0/P1 findings in audit artifacts are closed or explicitly deferred with rationale.

## Risk Controls

1. **Doc ambiguity risk:** when Manual vs Atlas phrasing differs, annotate inference and prefer latest product-specific page.
2. **Version drift risk:** enforce explicit “available starting in X” wording in sensitive rules.
3. **Build drift risk:** single pipeline for all skills; avoid manual AGENTS curation.
4. **Regression risk:** keep a “changed claims register” with before/after wording for P0 items.

## Delivery Order Recommendation

1. Wave 1 (P0 factual correctness)
2. Wave 3 (validator/build unblock)
3. Wave 2 (feature freshness)
4. Wave 4 (CI and links)
5. Wave 5 (long-term operations)

This order minimizes risk of shipping incorrect guidance while restoring release confidence quickly.
