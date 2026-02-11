# Scope and Methodology

## Repositories Audited

- MongoDB skills repo:
  - `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills`
- Vercel reference repo:
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/agent-skills`
- MongoDB docs mirror:
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs`

## Audit Method

1. Pulled latest refs and recorded HEAD snapshots (`data/repo_head_snapshot.csv`).
2. Enumerated all rule files and measured structural consistency (`data/rule_*`, `data/rules_missing_sections.csv`).
3. Ran local validator (`pnpm validate` in build package).
4. Compared build/packaging architecture against Vercel reference build tooling.
5. Performed factual cross-check on high-risk claims against MongoDB docs source files.
6. Ran reference URL health checks for rule-level `Reference:` links.
7. Consolidated findings by severity and produced remediation roadmap.

## What “Complete” Means in This Audit

A skill is considered complete when all are true:

- Rule structure is consistent with expected sections.
- Factual statements align with current MongoDB docs.
- Build/validate/extract pipeline is reproducible for every skill.
- Compiled docs (`AGENTS.md`) are synchronized with source rules/metadata.
- References are healthy and point to stable docs pages.

## Limitations

- MongoDB docs corpus is huge; this pass targeted highest-risk correctness surfaces first (version-sensitive and semantics-sensitive guidance).
- This audit is a **baseline** snapshot on February 10, 2026, intended as phase 1 in a long-term quality program.
