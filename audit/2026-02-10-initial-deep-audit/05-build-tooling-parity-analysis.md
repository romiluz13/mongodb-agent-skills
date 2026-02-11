# Build Tooling Parity Analysis

## Summary

MongoDB build tooling is close to the Vercel pattern but not yet equivalent.

## Findings

### P1 - `mongodb-ai` excluded from build/extract scripts

- `package.json` build scripts include schema + query only.
- No `build-ai` or `extract-tests-ai` script.

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build/package.json`

### P1 - Config map does not define AI sections

- `SECTION_MAPS` includes only two skills.
- No explicit section map for `mongodb-ai`.

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build/src/config.ts`

### P2 - Display name mapping excludes AI

- `getSkillDisplayName()` only maps schema/query.

Evidence:
- `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build/src/build.ts`

### P2 - No `--all` orchestration parity

- Vercel tooling supports full multi-skill build with `--all`.
- Mongo tooling uses positional skill argument without global all-skills mode.

Evidence:
- Reference: `/Users/rom.iluz/Dev/mongodb-best-practices/referance/agent-skills/packages/react-best-practices-build/src/build.ts`
- Mongo: `/Users/rom.iluz/Dev/mongodb-best-practices/mongodb-agent-skills/packages/mongodb-skills-build/src/build.ts`

## Impact

- Increases probability of stale compiled docs for AI skill.
- Makes cross-skill release automation fragile.
- Encourages manual rather than deterministic regeneration.

## Recommendation

Adopt Vercel-style `SKILLS` registry + `--all` build mode + explicit `mongodb-ai` pipeline entry points.
