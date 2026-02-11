# Transactions Consistency Skill Roadmap (Sprint 12)

## Objective

Add `mongodb-transactions-consistency` as a high-impact, non-redundant skill that addresses MongoDB ACID correctness, consistency semantics, and retry-safe transaction behavior.

## Non-Redundancy Contract

1. `mongodb-schema-design` remains source of truth for document model patterns and schema anti-patterns.
2. `mongodb-query-and-index-optimize` remains source of truth for query/index performance tuning.
3. `mongodb-ai` remains source of truth for vector/RAG/hybrid AI behavior.
4. `mongodb-transactions-consistency` covers only multi-document correctness, retry semantics, consistency guarantees, and transaction operations constraints.

## Phase Plan

### Phase A: Source Lock and Version Reconciliation

- Confirm latest release line baseline from official docs.
- Reconcile user prompt reference (`8.25`) with official patch notation (`8.2.5`).
- Capture authoritative transaction sources and error-label docs.

### Phase B: Skill Design and Authoring

- Create 5-section structure:
  - Transaction Fundamentals
  - Consistency Semantics
  - Retry and Error Handling
  - Operational Constraints
  - Implementation Patterns
- Author 20 rules with bad/good examples and verify diagnostics.

### Phase C: Pipeline and Guardrail Integration

- Integrate skill into build/extract scripts and section mapping.
- Extend version-claim and semantic-invariant registries with transaction-sensitive assertions.
- Ensure strict installer includes the new skill.

### Phase D: Validation and Release Readiness

- Build AGENTS/test cases for all skills.
- Run `validate`, `check-links`, `check-version-claims`, `check-semantic-invariants`, and `check-release-watch`.
- Update root catalog/docs and plugin metadata to advertise the fourth skill.

## Acceptance Criteria

1. New skill compiles into `AGENTS.md` and `test-cases.json`.
2. All build and quality gates pass with no broken references.
3. Release-watch confirms expected 8.2.5 baseline.
4. Root docs and plugin metadata reflect 4 skills and 129 total rules.
5. Rule scope contains no schema/query/vector-search redundancy.
