# Docs Drift Audit Runbook (Recurring)

## Purpose

Keep MongoDB skills aligned with current MongoDB documentation and release lines (`8.0`, `8.1`, `8.2.x`, and newer).

## Cadence

1. **Monthly** baseline audit run.
2. **Release-triggered** audit run when MongoDB publishes new minor/patch release notes that affect covered features.
3. **Pre-release** audit run before publishing skill updates.

## Inputs

1. Local MongoDB docs mirror at `referance/mongodb-docs`.
2. Live official docs pages for version-sensitive claims.
3. Skill rule sources under `plugins/mongodb-agent-skills/skills/*/rules`.

## Procedure

1. **Sync references**
   - Pull latest `referance/mongodb-docs` and `referance/agent-skills`.
   - Record commit SHAs in audit artifacts.

2. **Run structural gates**
   - `pnpm --dir packages/mongodb-skills-build validate`
   - `pnpm --dir packages/mongodb-skills-build build`
   - `pnpm --dir packages/mongodb-skills-build check-links`
   - `pnpm --dir packages/mongodb-skills-build check-version-claims`
   - `pnpm --dir packages/mongodb-skills-build check-semantic-invariants`
   - `npx -y skills add <repo-path> --list` (verify external `skills` CLI discoverability of published skills)

3. **Run version drift checks**
   - Re-verify latest release family and patch levels from official release notes.
   - Update and review registry assertions in:
     - `packages/mongodb-skills-build/config/version-claim-registry.json`
   - Re-check version-gated rules for claims around:
     - `$queryStats`
     - `setQuerySettings`
     - `bulkWrite`
     - `$vectorSearch` / views / `$unionWith`
     - `$rankFusion` / `$scoreFusion`
     - automated embedding deployment split (`autoEmbed` self-managed Community 8.2+ vs Atlas private-preview track)
     - schema validation (`errorAndLog` compatibility)

4. **Capture findings**
   - Add or update gap matrix CSV/MD files in this audit folder.
   - Mark task IDs as `DONE` / `OPEN` in remediation status files.
   - Refresh external skill-ecosystem references (e.g., `agentskills.io/specification`) when governance assumptions change.

5. **Regenerate deliverables**
   - Ensure `AGENTS.md` and `test-cases.json` remain in sync with rule sources.

## Exit Criteria

1. Validation passes for all rules.
2. Link health check passes.
3. Version-sensitive claims verified against current docs.
4. Version-claim integrity check passes for critical rules.
5. Audit status files updated with concrete evidence references.
6. Query/Schema rules retain explicit `## Verify with` sections after any bulk edits.
7. Registry assertions and source evidence files are updated together when version boundaries change.
8. Stakeholder-critical topics (`lexical prefilter`, `rankFusion`, `scoreFusion`, `queryStats`, `setQuerySettings`, `bulkWrite`, `automated embedding deployment boundaries`) remain explicitly enforced in registry checks.
9. Semantic-invariant registry remains aligned with high-risk rule set and passes in CI.

## Ownership

- Primary owner: MongoDB skills maintainers.
- Secondary owner: CI pipeline (`mongodb-skills-ci.yml`) enforces build/validate/link-health gates.
