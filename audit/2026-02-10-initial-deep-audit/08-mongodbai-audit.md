# Skill Audit: MongoDBAI (`mongodb-ai`)

## Strengths

- Strong topical spread across vector index, query, RAG, hybrid search, and agent memory.
- Full frontmatter and `Incorrect`/`Correct`/`When NOT to use` coverage across all 33 rules.

## Findings

### P0 - HNSW defaults/ranges are incorrect

Rule states:
- `maxEdges` default/range as `32` and `4-100`
- `numEdgeCandidates` range as `4-1000`

Docs state:
- `maxEdges`: `16-64`, default `16`
- `numEdgeCandidates`: `100-3200`, default `100`

Evidence:
- Skill: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-hnsw-options.md`
- Docs: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/atlas/source/includes/avs/index/list-table-fields.rst`

### P0 - View query behavior (8.0 vs 8.1+) is misrepresented

Rule examples/query notes imply direct view querying in contexts that docs reserve for 8.1+.

Docs behavior:
- On 8.0: create index on view, query source collection.
- On 8.1+: query the view directly.

Evidence:
- Skill: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-views-partial.md`
- Docs: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/atlas/source/includes/search-shared/fact-partial-indexing-reqs.rst`

### P1 - Version guidance in common errors is incomplete

`"$vectorSearch is not allowed"` guidance only references `< 7.0.2`; docs also reference `6.0.11` baseline.

Evidence:
- Skill: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai/SKILL.md`
- Docs:
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/atlas/source/atlas-vector-search/vector-search-stage.txt`
  - `/Users/rom.iluz/Dev/mongodb-best-practices/referance/mongodb-docs/content/atlas/source/atlas-vector-search/troubleshooting.txt`

### P1 - `Verify with` missing from all AI rules

- 33/33 rules missing `Verify with` section.

Evidence:
- `data/rule_structure_metrics.csv`
- `data/rules_missing_sections.csv`

### P2 - Broken reference URL

- `https://mongodb.com/docs/atlas/cluster-tier-overview/` returns 404.

Evidence:
- `data/reference_url_status.csv`
- `data/broken_reference_locations.csv`

### P2 - Compiled artifact format drift

`mongodb-ai/AGENTS.md` is condensed guide format and not in parity with compiled per-rule structure used by other skills.

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-ai/AGENTS.md`

## Readiness

- **Not release-ready** without factual corrections and verification-section rollout.
