# Automated Embedding Deployment Reconciliation (Sprint 8)

## Problem Detected

`mongodb-ai/rules/index-automated-embedding.md` had stale guidance that mixed preview tracks and omitted the self-managed Community 8.2+ `autoEmbed` path now documented in Atlas Vector Search docs.

## Evidence Summary

From current docs corpus (checked 2026-02-10):

1. `vector-search-type` docs show **self-managed automated embedding** as a Preview feature and define `autoEmbed` syntax.
2. `create-embeddings-automatic` docs define Community 8.2+ prerequisites, `autoEmbed` index fields, and query semantics using `query.text`.
3. `automated-embedding` docs remain a **hidden/private-preview Atlas track** with M10+ requirements and older `text`/voyage-3 model framing.

## Remediation Applied

Updated:

- `plugins/mongodb-agent-skills/skills/mongodb-ai/rules/index-automated-embedding.md`

Key corrections:

1. Added explicit deployment split:
   - Community 8.2+ self-managed preview (`autoEmbed` path)
   - Atlas private-preview path (different constraints)
2. Replaced primary "correct" index/query examples with current `autoEmbed` + `query.text` structure.
3. Updated supported-model guidance for Community `autoEmbed` path.
4. Preserved preview-state caution and deployment-specific limitations.

## Guardrails Added

Updated registry:

- `packages/mongodb-skills-build/config/version-claim-registry.json`

New assertions for `index-automated-embedding.md` enforce retention of:

1. `autoEmbed` syntax mention
2. Community Edition 8.2+ boundary
3. Atlas private-preview boundary

## Validation Outcome

All gates pass after remediation:

1. `pnpm --dir packages/mongodb-skills-build validate`
2. `pnpm --dir packages/mongodb-skills-build build`
3. `pnpm --dir packages/mongodb-skills-build check-links`
4. `pnpm --dir packages/mongodb-skills-build check-version-claims`
