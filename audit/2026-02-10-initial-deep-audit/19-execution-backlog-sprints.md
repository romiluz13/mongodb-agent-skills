# Execution Backlog and Sprint Breakdown

## Status Snapshot (as of 2026-02-11)

1. Sprint 1: **Completed**
2. Sprint 2: **Completed**
3. Sprint 3: **Completed**
4. Sprint 4: **Completed**
5. Sprint 5: **Completed**
6. Sprint 6: **Completed**
7. Sprint 7: **Completed**
8. Sprint 8: **Completed**
9. Sprint 9: **Completed**
10. Sprint 10: **Completed**

## Sprint 1: Critical Correctness and Release Unblock

1. `[DONE] FIX-001` Correct `$queryStats` version/behavior guidance in `perf-query-stats.md`.
2. `[DONE] FIX-002` Correct `bulkWrite` atomicity statement in `query-bulkwrite-command.md`.
3. `[DONE] FIX-003` Correct HNSW bounds/defaults in `index-hnsw-options.md`.
4. `[DONE] FIX-004` Correct view support versioning in `index-views-partial.md`.
5. `[DONE] FIX-005` Add incorrect/correct labeled examples in `perf-query-plan-cache.md`.

**Sprint 1 success metric:** all P0 items closed + validator passes.
**Sprint 1 outcome:** `pnpm --dir packages/mongodb-skills-build validate` passed for all 109 rules.

## Sprint 2: 8.1 Feature Completeness and Syntax Cleanup

1. `[DONE] FIX-006` Add query settings comment (8.1/8.0.4) and migration guidance to `perf-query-settings.md`.
2. `[DONE] FIX-007` Add `count`/`distinct` shape note for `$queryStats` compatibility.
3. `[DONE] FIX-008` Add `$unionWith` nuance to `query-vectorsearch-first.md`.
4. `[DONE] FIX-009` Add 8.1 rank-fusion/vectorSearch gating note.
5. `[DONE] FIX-010` Fix `$scoreFusion` syntax in `hybrid-weights.md`.
6. `[DONE] FIX-011` Add explicit 8192 max dimension note in vector-index rules.
7. `[DONE] FIX-012` Add schema `errorAndLog` downgrade caution in validation rollout docs.
8. `[DONE] FIX-022` Add explicit 8.2 `$rankFusion` on views note where hybrid/view guidance exists.
9. `[DONE] FIX-023` Add 8.2 `$queryStats` delinquency/CPU metric coverage in performance diagnostics rules.

**Sprint 2 success metric:** no remaining "incorrect" entries in 8.0/8.1 matrices.
**Sprint 2 outcome:** rule updates completed across all three skills and validator remains green (`109/109`).

## Sprint 3: Build/Packaging Parity and Operational Hardening

1. `[DONE] FIX-013` Add `mongodb-ai` to build scripts and test extraction.
2. `[DONE] FIX-014` Extend section mapping/display name config for `mongodb-ai`.
3. `[DONE] FIX-015` Regenerate all `AGENTS.md` outputs and verify parity.
4. `[DONE] FIX-016` Replace broken URLs (`cluster-tier-overview`, generic query operator index).
5. `[DONE] FIX-017` Add CI gates for validate/build/link health.
6. `[DONE] FIX-018` Add recurring docs-drift audit process and runbook.

**Sprint 3 success metric:** full green CI and deterministic artifact generation.
**Sprint 3 outcome:** tooling expanded to all three skills, generated outputs synchronized, link-health gate added and passing.

## Sprint 4: Release-Drift Hardening and Fresh Web Revalidation

1. `[DONE] FIX-024` Add release-sensitivity caveats in hybrid fusion rules (`hybrid-rankfusion.md`, `hybrid-scorefusion.md`, `hybrid-limitations.md`, `hybrid-weights.md`).
2. `[DONE] FIX-025` Add `$queryStats` output-stability caveat and strict-parser warning in `perf-query-stats.md`.
3. `[DONE] FIX-026` Add 8.2.x web revalidation artifact and refreshed source evidence CSV.
4. `[DONE] FIX-027` Add CI-enforced version-claim integrity checks for critical release-gated rules.

**Sprint 4 success metric:** refreshed web evidence recorded and all gates remain green after rule adjustments.
**Sprint 4 outcome:** version-sensitive wording hardened and audit evidence updated for 8.2.x release drift.

## Sprint 5: Drift-Resistance Expansion and Section Consistency

1. `[DONE] FIX-028` Standardize `## Verify with` sections across Query and Schema rules.
2. `[DONE] FIX-029` Expand `check-version-claims` to enforce Verify sections and fusion preview guidance.
3. `[DONE] FIX-030` Correct section-level summary drift in `_sections.md` (bulkWrite atomicity and `$queryStats` framing).
4. `[DONE] FIX-031` Refresh version reconciliation artifact with compatibility-versioned docs.

**Sprint 5 success metric:** all validation/link/version-claim gates pass after broad rule-shape enforcement.
**Sprint 5 outcome:** CI now protects both content correctness and verification-section consistency at scale.

## Sprint 6: Registry-Driven Enforcement and Upstream Refresh

1. `[DONE] FIX-032` Externalize version-claim assertions into `version-claim-registry.json`.
2. `[DONE] FIX-033` Refactor checker to load path/file requirements and prohibitions from registry.
3. `[DONE] FIX-034` Add automated guards for section-summary drift and verify-section completeness.
4. `[DONE] FIX-035` Pull latest MongoDB docs/Vercel references and capture updated SHAs.

**Sprint 6 success metric:** registry-driven claim checks pass and upstream reference snapshot is refreshed.
**Sprint 6 outcome:** version-claim governance moved from hardcoded logic to auditable config with stronger drift protection.

## Sprint 7: Stakeholder-Critical Feature Guardrails and Spec Reference Sweep

1. `[DONE] FIX-036` Expand registry checks for lexical prefilter, HNSW bounds/defaults, 8192 dimension limits, queryStats 8.2 diagnostics wording, and bulkWrite atomicity framing.
2. `[DONE] FIX-037` Reconcile MongoDB 8.2.1/8.2.5 release-line facts with refreshed official web evidence.
3. `[DONE] FIX-038` Capture agentskills.io specification and integration references as best-practice governance inputs.
4. `[DONE] FIX-039` Record Sprint 7 execution and status updates in backlog + status artifacts.

**Sprint 7 success metric:** `check-version-claims` enforces stakeholder-critical guidance areas and all validation gates remain green.
**Sprint 7 outcome:** critical MongoDB.AI and Query semantics are now protected by additional CI assertions with refreshed research evidence.

## Sprint 8: MongoDB.AI Verification Coverage and Automated Embedding Reconciliation

1. `[DONE] FIX-040` Add `## Verify with` sections to all MongoDB.AI rule files.
2. `[DONE] FIX-041` Enforce MongoDB.AI Verify-with section presence via registry checks.
3. `[DONE] FIX-042` Correct `index-automated-embedding.md` for Community 8.2+ `autoEmbed` path and Atlas private-preview boundaries.
4. `[DONE] FIX-043` Add automated-embedding anti-drift assertions to registry.
5. `[DONE] FIX-044` Capture sprint-8 reconciliation evidence and status artifacts.

**Sprint 8 success metric:** all MongoDB.AI rules include verification guidance and automated-embedding claims are deployment-aware and CI-protected.
**Sprint 8 outcome:** MongoDB.AI skill guidance now reflects latest deployment-specific automated embedding capabilities with stronger drift resistance.

## Sprint 9: Semantic Guardrails and 8.2.5 Capability Matrix Baseline

1. `[DONE] FIX-045` Add high-risk semantic invariant checker (`check-semantic-invariants`) with registry-backed assertions.
2. `[DONE] FIX-046` Integrate semantic invariants into package scripts and CI workflow gates.
3. `[DONE] FIX-047` Create capability matrix baseline for MongoDB 8.2.5 across all three skills.
4. `[DONE] FIX-048` Refresh web evidence and update governance artifacts for Sprint 9 deliverables.

**Sprint 9 success metric:** semantic gate passes with full validation suite and capability matrix baseline is published.
**Sprint 9 outcome:** release safety moved beyond regex-only checks with rule-aware invariants and explicit capability tracking.

## Sprint 10: Cross-Agent Installation Parity with Vercel Skills CLI

1. `[DONE] FIX-049` Pull and audit latest `vercel-labs/skills` CLI + `vercel-labs/agent-skills` references for install/deploy patterns.
2. `[DONE] FIX-050` Replace deprecated `add-skill` docs with current `skills add` commands in top-level installation guidance.
3. `[DONE] FIX-051` Add explicit Claude/Codex/Cursor installation guidance in contributor + skill docs.
4. `[DONE] FIX-052` Run live `skills` CLI discovery verification against this repository (`--list`).
5. `[DONE] FIX-053` Record Sprint 10 artifacts, source evidence, and status updates.

**Sprint 10 success metric:** MongoDB docs reflect current `skills` CLI usage and repository is validated as discoverable/installable across Claude/Codex/Cursor flows.
**Sprint 10 outcome:** installation guidance now matches current ecosystem conventions and removes deprecated command usage.

## Deferred / Optional Hardening

1. `OPT-001` Expand `check-version-claims` from key-pattern checks to semantic diff checks against a machine-readable claim registry.
2. `OPT-002` Add richer semantic checks (AST-level or schema-aware) beyond regex for `_sections.md` and high-risk rules.
3. `OPT-003` Add automated source-link freshness checks per release line.
