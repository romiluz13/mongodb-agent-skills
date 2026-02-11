# MongoDB 8.2.1+ and Agent Skills Research Addendum (Sprint 7)

## Why this addendum exists

This sprint revalidated two things requested by stakeholders:

1. MongoDB version drift and feature coverage after the "8.21" clarification request.
2. Alignment with Agent Skills best-practice guidance (`agentskills.io`) as an external structural reference.

Checked on **2026-02-10**.

## Version-line clarification

The requested "MongoDB 8.21" maps to **MongoDB 8.2.1** (patch notation).

From current official release-notes page:

1. `8.2.1` appears as a patch release dated **October 3, 2025**.
2. Latest listed patch is `8.2.5` dated **February 10, 2026**.

This confirms the active release line is **8.2.x**, not a separate "8.21" minor.

## MongoDB feature revalidation for the three skills

## MongoDB.AI

1. **Lexical prefilters**: Atlas Vector Search changelog documents lexical prefilters in Public Preview (Nov 2025).
2. **Hybrid search baseline**: `\$rankFusion` remains available in MongoDB 8.0+.
3. **Score fusion**: `\$scoreFusion` remains available in MongoDB 8.2+.
4. **Diagnostics-sensitive guidance**: hybrid features remain release-sensitive and should keep preview caveats in skill text.

## Query and Index Optimization

1. **`\$queryStats` 8.2 diagnostics additions**: docs include CPU (`cpuNanos`) and delinquency-related fields.
2. **`setQuerySettings.comment` boundary**: docs continue to state availability in 8.1 and 8.0.4+.
3. **`bulkWrite` guidance**: command usage remains single-request cross-collection batching; atomic all-or-nothing requires transactions.

## Schema Advisor

1. Existing rollout/downgrade guidance for `errorAndLog` remains required and unchanged by this sprint's version recheck.

## Agent Skills best-practice research summary

From `agentskills.io` docs:

1. Skill format centers on `SKILL.md` with required frontmatter + instruction body.
2. Optional directories (`scripts/`, `references/`, `assets/`) are encouraged for progressive disclosure and deterministic workflows.
3. Integration docs formalize package-based installation and local-skill loading patterns.

These points are used here as **reference heuristics** for maintainability and governance, not as a direct replacement for this repository's existing skill build system.

## Sprint 7 action derived from this research

To reduce regression risk on stakeholder-critical topics, Sprint 7 expands registry-enforced checks so CI fails if any of the following drift:

1. Lexical prefilter preview and `\$search.vectorSearch` distinction guidance.
2. HNSW option defaults/ranges (`maxEdges`, `numEdgeCandidates`).
3. 8192-dimensional vector limits.
4. QueryStats 8.2 diagnostics wording (`cpuNanos`, delinquency).
5. Non-atomic `bulkWrite` framing + transaction fallback wording.

## Evidence files

1. `data/web_sources_2026-02-10_sprint7.csv`
2. `packages/mongodb-skills-build/config/version-claim-registry.json`
