# Skill Audit: Query and Index Optimization (`mongodb-query-and-index-optimize`)

## Strengths

- Largest rule surface (46 rules) with strong topic breadth.
- Full frontmatter coverage.
- Good index/query/aggregation/perf categorization.

## Findings

### P0 - Factual error: `$queryStats` introduction version

Rule states MongoDB 8.0 introduced `$queryStats`, but docs indicate:
- `versionadded:: 7.0.12` and also available in `6.0.7`.

Evidence:
- Skill: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/rules/perf-query-stats.md`
- Docs: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/v7.0/source/reference/operator/aggregation/queryStats.txt`

### P0 - Semantic overclaim: cross-collection atomicity in `bulkWrite` rule

Rule framing presents `bulkWrite` as cross-collection atomic as written. Docs emphasize one-request multi-collection operations and ordered/unordered semantics; atomicity baseline remains single-document writes unless transaction semantics are used.

Evidence:
- Skill: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/rules/query-bulkwrite-command.md`
- Docs:
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/manual/source/includes/bulkWrite-introduction.rst`
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/manual/source/reference/command/bulkWrite.txt`
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/manual/source/crud.txt`

### P1 - Validation blocker

`pnpm validate` fails due missing bad/good example labels in:
- `perf-query-plan-cache.md`

Evidence:
- Validator output from `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build`

### P2 - Compiled drift

- `AGENTS.md` version = 2.1.0 while SKILL/metadata are 2.3.0.
- `AGENTS.md` abstract says 39 rules vs actual 46.

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/AGENTS.md`
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/SKILL.md`
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/metadata.json`

### P2 - Broken reference URL

- `https://mongodb.com/docs/manual/reference/operator/query/` returns 404.

Evidence:
- `data/reference_url_status.csv`
- `data/broken_reference_locations.csv`

## Readiness

- **Not release-ready** until factual and validator blockers are resolved.
