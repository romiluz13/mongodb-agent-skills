# Agent Installation and CLI Parity Audit (Vercel Reference)

## Objective

Validate and align MongoDB skills installation/distribution patterns with the latest Vercel `agent-skills` + `skills` CLI practices across Claude Code, Codex, and Cursor.

## Upstream Snapshot (Pulled)

1. `referance/agent-skills` (`vercel-labs/agent-skills`): `e23951b8cad2f4b1e7e176c5731127c1263fe86f`
2. `referance/skills-cli` (`vercel-labs/skills`): `556555c`
3. `referance/mongodb-docs`: `40841da4ef5ff84dfdcf345f63ab8d1249816b78` (unchanged; retained for MongoDB feature validation context)

## What Vercel Does (State-of-the-Art Pattern)

1. Uses a dedicated CLI package: `skills` (bin: `skills`, alias `add-skill`).
2. Standard install entrypoint is `npx skills add <source>`.
3. Supports repository shorthand, full git URLs, specific skill paths, and local paths.
4. Supports explicit multi-agent targeting via `--agent` and non-interactive CI usage via `--yes`.
5. Supports project vs global scopes (`default` vs `-g`) and install mode selection (`symlink` preferred, copy fallback).
6. Maintains per-agent install paths in a single source of truth (`src/agents.ts`), including:
   - Claude Code: project `.claude/skills/`, global `~/.claude/skills/`
   - Codex: project `.agents/skills/`, global `~/.codex/skills/`
   - Cursor: project `.cursor/skills/`, global `~/.cursor/skills/`
7. Tracks installed skills and update metadata in `~/.agents/.skill-lock.json` (`check` / `update` flows).
8. Discovers skills in standard directories and Claude plugin manifests (`.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`).
9. Auto-syncs README agent tables and keywords from code (`scripts/sync-agents.ts`) to prevent docs drift.

## MongoDB Repo Gap Findings

1. Top-level install command used deprecated `npx add-skill ...`.
2. Contributor guidance (`AGENTS.md`) described only Claude-first manual install patterns.
3. `mongodb-ai/README.md` installation section was Claude-only.

## Remediation Applied

1. Updated top-level install instructions to current CLI:
   - `README.md` now uses `npx skills add ...` with Claude/Codex/Cursor examples.
2. Expanded contributor install guidance:
   - `AGENTS.md` now includes `skills` CLI recommended flow plus manual Claude/Codex/Cursor fallbacks.
3. Expanded skill-level install guidance:
   - `plugins/mongodb-agent-skills/skills/mongodb-ai/README.md` now includes `skills` CLI + manual Claude/Codex/Cursor options.
4. Live CLI discovery validation:
   - `npx -y skills add /Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills --list`
   - Result: discovered all 3 skills (`mongodb-ai`, `mongodb-query-and-index-optimize`, `mongodb-schema-design`).

## Compatibility Note

`add-skill` still forwards to `skills add`, but is explicitly deprecated by the tool output. Documentation should prefer `npx skills add ...` moving forward.

## Can MongoDB Do the Same?

Yes. The repository is already structurally compatible with the `skills` CLI ecosystem and Claude plugin manifests. The updated docs now reflect the recommended cross-agent installation model for Claude Code, Codex, and Cursor.
