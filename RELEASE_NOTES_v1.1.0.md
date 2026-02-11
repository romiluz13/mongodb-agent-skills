# MongoDB Agent Skills v1.1.0

Release date: 2026-02-11

## Highlights

- Added a new skill: **`mongodb-transactions-consistency`** (20 rules)
- Expanded suite to **4 skills / 129 rules**
- Added production-focused guidance for:
  - ACID transaction boundaries
  - readConcern/writeConcern consistency choices
  - `TransientTransactionError` full retry behavior
  - `UnknownTransactionCommitResult` commit retry handling
  - lock/time/ops constraints in production
- Updated strict installer to include all 4 skills by default

## Skill Versions

- `mongodb-schema-design`: `2.2.0`
- `mongodb-query-and-index-optimize`: `2.4.0`
- `mongodb-ai`: `1.4.0`
- `mongodb-transactions-consistency`: `1.0.0`

## Quality Gates

All release gates passed:

- build
- validate
- check-links
- check-version-claims
- check-semantic-invariants
- check-release-watch

Release-watch confirms expected latest MongoDB 8.2 patch baseline: **8.2.5**.
