# MongoDB Search Skill

MongoDB Search engine guidance for Atlas and self-managed deployments.

## Why This Skill Exists

AI assistants often mix Atlas Search and self-managed Community Search assumptions. This skill prevents those mistakes by enforcing:

- Deployment routing and release-stage gates
- Search mapping and analyzer guardrails
- Correct `$search` and `$searchMeta` query composition
- Hybrid search stage/version constraints
- Operational runbooks for Search alerts and index failures

## Installation

### Claude Code plugin
Use the root install flow in `/README.md`.

### Agent Skills CLI
```bash
npx skills add romiluz13/mongodb-agent-skills --skill mongodb-search -a claude-code -a codex -a cursor
```

### Claude.ai
Add this skill folder to project knowledge, or paste `SKILL.md`.

## What's Included

### 24 Rules Across 6 Categories

| Category | Impact | Rules |
|----------|--------|-------|
| Deployment Modes and Release Gates | CRITICAL | 5 |
| Index Architecture and Mappings | CRITICAL | 6 |
| Query Composition and Relevance | CRITICAL | 5 |
| Hybrid and Vector Interop | HIGH | 3 |
| Operations and Troubleshooting | HIGH | 4 |
| Skill Boundary Rules | MEDIUM | 1 |

## Files

```
mongodb-search/
  SKILL.md
  AGENTS.md
  metadata.json
  README.md
  references/
    docs-navigation.md
  rules/
    _sections.md
    _template.md
    deploy-*.md
    index-*.md
    query-*.md
    hybrid-*.md
    ops-*.md
    boundary-*.md
  test-cases.json
```

## Scope Boundary

This skill owns search engine semantics and operations. It intentionally hands off model/provider and RAG semantics to `mongodb-ai`.
