# MongoDB Agent Skills v1.2.0

Release date: 2026-02-18

## Highlights

- Added a new skill: **`mongodb-search`** (24 rules)
- Expanded suite to **5 skills / 153 rules**
- Added production-focused guidance for:
  - deployment routing (Atlas vs local Atlas vs Community Search)
  - release-stage gating (GA vs Preview/Public Preview)
  - Search field explosion and nGram guardrails
  - `$search` / `$searchMeta` query composition and result-shaping
  - `$rankFusion` / `$scoreFusion` compatibility and stage limits
  - Search alert triage and reindex change management
- Final hardening pass before ship:
  - added Kubernetes Operator self-managed routing to search deployment gates
  - clarified Community auth prerequisites for manual vs operator setup
  - aligned fusion-stage constraints to current docs semantics

## Skill Versions

- `mongodb-schema-design`: `2.2.0`
- `mongodb-query-and-index-optimize`: `2.4.0`
- `mongodb-search`: `1.0.1`
- `mongodb-ai`: `1.5.0`
- `mongodb-transactions-consistency`: `1.0.0`

## Quality Gates

All release gates passed:

- rule inventory parity
- test-case structural validation
- installer/catalog inclusion
- docs and metadata update consistency
