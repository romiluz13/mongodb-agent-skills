# Schema Advisor Feature Gap Matrix (8.0 -> 8.1 Focus)

## Scope

- Skill path: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/plugins/mongodb-agent-skills/skills/mongodb-schema-design`
- Rules analyzed: 30
- Goal: verify schema-validation and schema-governance guidance against latest 8.0/8.1-compatible behavior.

## Coverage Snapshot

- **Strong overall quality:** schema fundamentals and migration patterns are well represented.
- **Main 8.1 gap:** downgrade caveat for `validationAction: "errorAndLog"` is not made explicit in operational rollout guidance.
- **No newly discovered P0 factual defects** in the schema skill during this pass.

## Feature Matrix

| Capability | MongoDB Source of Truth | Current Skill Coverage | Status | Impacted Rule Files | Required Fix |
|---|---|---|---|---|---|
| Validation actions include `errorAndLog` in 8.1+ | schema-validation docs | Mentioned in rule tables/examples | Covered | `validation-action-levels.md` | Keep |
| `errorAndLog` downgrade caveat | compatibility note: cannot downgrade until action changed or collection dropped | Not explicitly highlighted | Partial | `validation-action-levels.md`, `validation-rollout-strategy.md` | Add explicit downgrade risk section + rollback procedure |
| Moderate/warn rollout for legacy datasets | schema-validation docs | Well covered | Covered | `validation-action-levels.md`, `validation-rollout-strategy.md` | Keep |
| Validation governance and staged hardening | schema design rules | Covered | Covered | `validation-rollout-strategy.md` | Keep |

## New/Updated Findings (Schema)

1. **P1**: Add explicit downgrade caveat guidance for `errorAndLog` in rollout and operations runbook sections.
2. **P2**: Add one short “version boundaries” callout block in validation rules to reduce operator confusion during mixed-version deployments.
