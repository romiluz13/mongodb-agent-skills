# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

## Repository Overview

A collection of skills for Claude.ai and Claude Code for MongoDB development. Skills are packaged instructions that extend Claude's capabilities for schema design, query optimization, and indexing strategies.

## Creating a New Skill

### Directory Structure

```
skills/
  {skill-name}/           # kebab-case directory name
    SKILL.md              # Required: skill definition
    metadata.json         # Required: skill metadata
    rules/                # Required: rule files
      _sections.md        # Section definitions
      {prefix}-{name}.md  # Individual rules
  {skill-name}.zip        # Optional: packaged for distribution
```

### Naming Conventions

- **Skill directory**: `kebab-case` (e.g., `mongodb-schema-design`, `mongodb-query-optimize`)
- **SKILL.md**: Always uppercase, always this exact filename
- **Rule files**: `{section-prefix}-{rule-name}.md` (e.g., `index-compound-field-order.md`)
- **Zip file**: Must match directory name exactly: `{skill-name}.zip`

### SKILL.md Format

```markdown
---
name: {skill-name}
description: {One sentence describing when to use this skill. Include trigger phrases.}
license: Apache-2.0
metadata:
  author: mongodb
  version: "1.0.0"
---

# {Skill Title}

{Brief description of what the skill does.}

## When to Apply

{List of scenarios when this skill should be used}

## Rule Categories by Priority

{Table of categories with impact levels and prefixes}

## Quick Reference

{List of rules organized by category}
```

### Rule File Format

```markdown
---
title: Rule Title
impact: CRITICAL|HIGH|MEDIUM
impactDescription: "e.g., 10-100× improvement"
tags: tag1, tag2, tag3
---

## Rule Title

Brief explanation of why this matters.

**Incorrect (problem):**
```javascript
// Bad code example
```

**Correct (solution):**
```javascript
// Good code example
```

Reference: [Link to MongoDB docs]
```

### Best Practices for Context Efficiency

Skills are loaded on-demand — only the skill name and description are loaded at startup. The full `SKILL.md` loads into context only when the agent decides the skill is relevant. To minimize context usage:

- **Keep SKILL.md under 500 lines** — put detailed rules in separate files
- **Write specific descriptions** — helps the agent know exactly when to activate the skill
- **Use progressive disclosure** — reference rule files that get read only when needed
- **Keep rules under 50 lines** — split large concepts into multiple rules

### End-User Installation

Document these two installation methods for users:

**Claude Code:**
```bash
cp -r skills/{skill-name} ~/.claude/skills/
```

**claude.ai:**
Add the skill to project knowledge or paste SKILL.md contents into the conversation.

## MongoDB-Specific Guidelines

### Code Examples

- Use MongoDB Shell syntax (universal, works everywhere)
- Do NOT use driver-specific syntax (Node.js, Python, etc.)
- Keep examples under 15 lines
- Show clear bad → good transformations

### Impact Levels

- **CRITICAL**: 10-100× improvement (collection scans → index usage)
- **HIGH**: 2-10× improvement (query optimization)
- **MEDIUM**: 20-100% improvement (pipeline optimizations)

### Sources

All rules should reference official MongoDB documentation:
- https://mongodb.com/docs/manual/
- https://mongodb.com/docs/atlas/
- https://mongodb.com/blog/
