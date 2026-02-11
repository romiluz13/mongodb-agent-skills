# Sprint 11 Execution Log (2026-02-11)

## Objective

Improve installation UX/DX with deterministic commands for:
- install all skills
- install selected skills
- uninstall selected/all skills
- reset from scratch

while avoiding unexpected agent auto-selection behavior.

## Tasks Executed

1. **FIX-054** Added strict local installer CLI.
   - Added:
     - `scripts/mongodb-skills-cli.sh`
   - Commands:
     - `install-all`
     - `install-select --skills ...`
     - `uninstall-all`
     - `uninstall-select --skills ...`
     - `reset`
     - `list`
   - Agent scope:
     - `claude-code`, `codex`, `cursor`

2. **FIX-055** Improved CLI help behavior.
   - Updated:
     - `scripts/mongodb-skills-cli.sh`
   - Fix:
     - `./scripts/mongodb-skills-cli.sh --help` now exits cleanly with status 0.

3. **FIX-056** Updated user-facing docs for strict install workflows.
   - Updated:
     - `README.md`
     - `AGENTS.md`
   - Added explicit install/select/uninstall/reset/list examples and strict-agent guidance.

4. **FIX-057** Executed clean reinstall workflow in real local agent paths.
   - Ran:
     - `./scripts/mongodb-skills-cli.sh reset`
     - `./scripts/mongodb-skills-cli.sh list`
   - Result:
     - All 3 MongoDB skills installed for Claude Code, Codex, and Cursor.

## Validation

1. `./scripts/mongodb-skills-cli.sh --help` -> PASS
2. `./scripts/mongodb-skills-cli.sh list` -> PASS
3. `./scripts/mongodb-skills-cli.sh reset` -> PASS
4. `./scripts/mongodb-skills-cli.sh uninstall-select --skills mongodb-ai --agents codex` -> PASS
5. `./scripts/mongodb-skills-cli.sh install-select --skills mongodb-ai --agents codex` -> PASS

## Outcome

1. CLI UX now supports explicit "install all" and "select skills to install" flows.
2. Clean uninstall/reinstall from scratch is now a first-class command path.
3. Installation behavior is deterministic for Claude/Codex/Cursor via local strict CLI usage.
