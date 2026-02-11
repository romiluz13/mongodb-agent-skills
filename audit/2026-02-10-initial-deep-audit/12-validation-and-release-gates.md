# Validation and Release Gates

## Current Validation Result

- Command run:
  - `pnpm --dir packages/mongodb-skills-build validate`
  - `pnpm --dir packages/mongodb-skills-build build`
  - `pnpm --dir packages/mongodb-skills-build check-links`
  - `pnpm --dir packages/mongodb-skills-build check-version-claims`
  - `pnpm --dir packages/mongodb-skills-build check-semantic-invariants`
  - `pnpm --dir packages/mongodb-skills-build check-release-watch`
- Result: **PASS**
- Evidence:
  - Validator passes for all `109` rules across 3 skills.
  - Build regenerates `AGENTS.md` and `test-cases.json` for all 3 skills.
  - Link checker reports all discovered reference URLs reachable.
  - Version-sensitive claim checks pass for critical release-gated rules and required `Verify with`/preview safeguards.
  - Release-watch checks confirm latest observed MongoDB 8.2 patch matches validated baseline.

## Implemented CI Gates

1. **Structure gate**
   - `pnpm validate` runs for all skills.
2. **Compile-sync gate**
   - `pnpm build` regenerates `AGENTS.md` and `test-cases.json`; CI fails on uncommitted diffs.
3. **Reference-health gate**
   - `pnpm check-links` checks all rule `Reference:` URLs for 2xx/3xx reachability.
4. **Version-sensitive fact gate**
   - Enforced via `pnpm check-version-claims` using registry config:
     - `packages/mongodb-skills-build/config/version-claim-registry.json`
   - Current registry scope includes hard assertions for:
     - lexical prefilter preview and `$search.vectorSearch` distinction
     - HNSW defaults/ranges and 8192 dimension boundaries
     - `$queryStats` 8.2 diagnostics wording (`cpuNanos`, delinquency)
     - non-atomic `bulkWrite` semantics plus transaction fallback guidance
     - automated embedding deployment boundaries (`autoEmbed` Community 8.2+ vs Atlas private-preview track)
5. **Coverage gate**
   - Structural requirement for bad/good examples enforced by validator.
6. **Verification-evidence gate**
   - Query/Schema/AI rules must include `## Verify with` guidance.
7. **High-risk semantic invariant gate**
   - `pnpm check-semantic-invariants` enforces heading/phrase/example-level assertions for critical version-sensitive rules via:
     - `packages/mongodb-skills-build/config/semantic-invariant-registry.json`
8. **Release-line drift gate**
   - `pnpm check-release-watch` validates latest observed MongoDB patch line against audited baseline via:
     - `packages/mongodb-skills-build/config/release-watch-registry.json`

## Release Criteria

A release is allowed only when:

- P0 findings = 0
- P1 findings = 0
- Validation gates all pass
- Broken references = 0
- Compiled artifacts are synchronized
- Release-watch baseline is current (no newer un-audited patch release detected)
