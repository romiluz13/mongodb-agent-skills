# Critical and Major Findings

## P0 Findings

1. `$queryStats` version misstatement
   - File: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/rules/perf-query-stats.md`
   - Problem: says 8.0 introduced it.
   - Docs: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/v7.0/source/reference/operator/aggregation/queryStats.txt`

2. `bulkWrite` atomicity overclaim
   - File: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/rules/query-bulkwrite-command.md`
   - Problem: “atomic across collections” phrasing is misleading.
   - Docs:
     - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/manual/source/reference/command/bulkWrite.txt`
     - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/manual/manual/source/crud.txt`

3. HNSW option defaults/ranges wrong
   - File: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-hnsw-options.md`
   - Docs: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/atlas/source/includes/avs/index/list-table-fields.rst`

4. View support behavior mis-specified
   - File: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-views-partial.md`
   - Docs: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/atlas/source/includes/search-shared/fact-partial-indexing-reqs.rst`

## P1 Findings

1. Build parity gap excludes `mongodb-ai`
   - Files:
     - `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build/package.json`
     - `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build/src/config.ts`

2. Validator fails on current rule set
   - Command: `pnpm validate`
   - Failure file: `perf-query-plan-cache.md`

3. AI rules have zero verification sections
   - Evidence: `data/rule_structure_metrics.csv`

4. Broken docs links in active rules
   - Evidence: `data/reference_url_status.csv`

## P2 Findings

1. Compiled docs drift (version/rule counts out of sync)
2. Mixed compiled style (`mongodb-ai/AGENTS.md` not in parity)
3. Missing optional but important sections in subsets of schema/query rules
