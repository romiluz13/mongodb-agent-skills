# Vercel Reference Patterns (State-of-the-Art Baseline)

## Key Patterns Observed

1. Multi-skill build orchestration via a centralized `SKILLS` map.
2. `--all` build mode for deterministic full regeneration.
3. Skill-targeted build scripts (`build-react`, `build-rn`, etc.).
4. Shared parser/validator/extractor tooling across skills.
5. Persistent `test-cases.json` artifact in build package.

## Evidence Files

- `/Users/rom.iluz/Dev/mongodb-best-practices/referance/agent-skills/packages/react-best-practices-build/package.json`
- `/Users/rom.iluz/Dev/mongodb-best-practices/referance/agent-skills/packages/react-best-practices-build/src/config.ts`
- `/Users/rom.iluz/Dev/mongodb-best-practices/referance/agent-skills/packages/react-best-practices-build/src/build.ts`
- `/Users/rom.iluz/Dev/mongodb-best-practices/referance/agent-skills/packages/react-best-practices-build/test-cases.json`

## Why It Matters for MongoDB Skills

These patterns reduce drift and make it difficult for one skill to become “special case” unmanaged content. They also improve CI predictability and ensure compiled docs stay synchronized across all skills.
