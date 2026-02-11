# 15-Parameter Audit Rubric

Each parameter is scored 0-5 per skill.

- 5: fully meets requirement
- 4: minor issues
- 3: meaningful gaps
- 2: high-risk inconsistency
- 1: severe deficiency
- 0: missing

## Parameters

1. Rule inventory completeness
2. Frontmatter completeness (`title`, `impact`, `tags`)
3. `Incorrect` example coverage
4. `Correct` example coverage
5. `When NOT to use` coverage
6. `Verify with` coverage
7. Reference presence per rule
8. Reference URL health
9. MongoDB docs factual accuracy
10. Version-awareness correctness
11. Build pipeline inclusion
12. Validation pass rate
13. Compiled artifact synchronization (`AGENTS.md`)
14. Category/prefix taxonomy consistency
15. Operational verification readiness (MCP/diagnostic commands quality)

## Scorecard (Baseline)

| Skill | Score (/75) | Notes |
|---|---:|---|
| `mongodb-schema-design` | 62 | Strong quality baseline; drift in compiled counts; minor missing sections. |
| `mongodb-query-and-index-optimize` | 53 | Excellent breadth but blocked by validator failure and multiple factual/semantic issues. |
| `mongodb-ai` | 47 | Broad topic coverage; missing `Verify with` on all rules; multiple factual issues; build parity gap. |

## Cross-Skill Readiness Interpretation

- **65-75**: Release candidate
- **55-64**: Needs focused hardening before release
- **45-54**: Significant remediation required
- **<45**: Rework required

Current program status: **Needs focused hardening; Query and AI skills are below release-candidate threshold**.
