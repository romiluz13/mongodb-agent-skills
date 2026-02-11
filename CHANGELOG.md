# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-02-11

### Added
- New skill: `mongodb-transactions-consistency` with 20 rules across:
  - Transaction Fundamentals
  - Consistency Semantics
  - Retry and Error Handling
  - Operational Constraints
  - Implementation Patterns
- Strict installer support for transactions skill in `scripts/mongodb-skills-cli.sh`.
- Extended validation guardrails for transaction-specific version and semantic invariants.
- Sprint 12 and final validation audit artifacts.

### Changed
- Skill suite expanded from 3 skills / 109 rules to **4 skills / 129 rules**.
- Installation/catalog/docs updated to include transactions consistency.
- Plugin metadata updated for release `1.1.0`.
- Build tooling version bumped to `2.1.0`.

### Version Bumps
- `mongodb-ai`: `1.3.0` -> `1.4.0`
- `mongodb-query-and-index-optimize`: `2.3.0` -> `2.4.0`
- `mongodb-schema-design`: `2.1.0` -> `2.2.0`
- `mongodb-transactions-consistency`: `1.0.0` (initial)
- Plugin release version: `1.0.0` -> `1.1.0`

### Validation
- Build/validate/version-claim/semantic-invariant/link/release-watch gates passing.
- Release-watch confirms MongoDB 8.2.5 baseline.

## [1.0.0] - 2026-02-11

### Added
- Initial published baseline with 3 skills:
  - `mongodb-schema-design` (30 rules)
  - `mongodb-query-and-index-optimize` (46 rules)
  - `mongodb-ai` (33 rules)
