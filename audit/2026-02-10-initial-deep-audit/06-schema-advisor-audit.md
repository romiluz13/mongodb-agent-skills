# Skill Audit: Schema Advisor (`mongodb-schema-design`)

## Strengths

- Rule count is complete at 30.
- Frontmatter completeness is 30/30 for `title`, `impact`, `tags`.
- `Correct` and `Verify with` sections are present in all rules.
- Category distribution is balanced and coherent.

Evidence:
- `data/rule_inventory.csv`
- `data/rule_structure_metrics.csv`
- `data/rule_prefix_distribution.csv`

## Findings

### P2 - Category count mismatch in SKILL.md

- Category table says design patterns = 9 while quick reference and rule files show 10.

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-schema-design/SKILL.md`

### P2 - Compiled AGENTS abstract says 29 rules (actual 30)

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-schema-design/AGENTS.md`

### P3 - Missing section consistency in a few rules

- Missing `Incorrect`:
  - `fundamental-16mb-awareness.md`
  - `pattern-outlier.md`
- Missing `When NOT to use`:
  - `antipattern-schema-drift.md`
  - `fundamental-16mb-awareness.md`

Evidence:
- `data/rules_missing_sections.csv`

## Readiness

- **Near-release quality** after drift and section-consistency cleanup.
