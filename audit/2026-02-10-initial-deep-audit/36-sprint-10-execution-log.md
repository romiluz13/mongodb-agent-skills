# Sprint 10 Execution Log (2026-02-11)

## Objective

Align MongoDB skills installation/distribution guidance with the latest Vercel `skills` CLI patterns across Claude Code, Codex, and Cursor.

## Tasks Executed

1. **FIX-049** Pulled latest Vercel reference repos and audited CLI internals.
   - Pulled:
     - `referance/agent-skills` (up to date)
     - `referance/skills-cli` (cloned/updated to latest `main`)
   - Audited:
     - `README.md`, `src/agents.ts`, `src/installer.ts`, `src/add.ts`, `src/skill-lock.ts`, `src/plugin-manifest.ts`

2. **FIX-050** Replaced deprecated install command in MongoDB top-level docs.
   - Updated:
     - `README.md`
   - Replaced `npx add-skill ...` guidance with `npx skills add ...` and explicit multi-agent examples.

3. **FIX-051** Added cross-agent installation guidance in contributor and skill docs.
   - Updated:
     - `AGENTS.md`
     - `plugins/mongodb-agent-skills/skills/mongodb-ai/README.md`
     - `plugins/mongodb-agent-skills/skills/mongodb-query-and-index-optimize/README.md`
     - `plugins/mongodb-agent-skills/skills/mongodb-schema-design/README.md`
   - Added CLI-based install guidance and manual fallback paths for Claude/Codex/Cursor.

4. **FIX-052** Verified live discovery compatibility using `skills` CLI.
   - Command:
     - `npx -y skills add /Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills --list`
   - Result:
     - All 3 MongoDB skills discovered and listed.
   - Additional install-path verification (isolated temp directory):
     - `npx -y skills add https://github.com/romiluz13/mongodb-agent-skills --skill mongodb-ai --skill mongodb-query-and-index-optimize --skill mongodb-schema-design -a claude-code -a codex -a cursor -y`
   - Result:
     - Canonical install into `./.agents/skills/*` and symlink mapping for Claude/Cursor validated.

5. **FIX-053** Added sprint-10 audit artifacts and status updates.
   - Added:
     - `35-agent-installation-cli-parity-audit.md`
     - sprint-10 status/evidence CSVs
   - Updated:
     - backlog/index/status trackers

## Validation

1. `pnpm --dir packages/mongodb-skills-build validate` -> PASS (`109/109`)
2. `npx -y skills add <repo-path> --list` -> PASS (3 skills discovered)
3. isolated temp install command above -> PASS (project-scope install layout validated for Claude/Codex/Cursor)

## Outcome

1. Installation guidance is now aligned with the current `skills` CLI standard.
2. MongoDB skills docs now explicitly support Claude Code, Codex, and Cursor workflows.
3. Deprecated `add-skill` usage has been removed from primary installation docs.
