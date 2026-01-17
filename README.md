# MongoDB Agent Skills

A collection of skills for AI coding agents. Skills are packaged instructions that extend agent capabilities for MongoDB development.

Skills follow the [Agent Skills](https://agentskills.io/) format and are compatible with **15+ coding agents** including Claude Code, OpenCode, Cursor, Codex, and more.

## Available Skills

### mongodb-schema-design

MongoDB data modeling patterns and anti-patterns from MongoDB Engineering. Contains **23 rules across 5 categories**, prioritized by impact.

**Use when:**
- Designing a new MongoDB schema
- Migrating from SQL to MongoDB
- Reviewing existing data models
- Troubleshooting slow queries caused by schema issues
- Deciding between embedding and referencing

**Categories covered:**
- Schema Anti-Patterns (Critical) - Unbounded arrays, bloated documents, schema drift
- Schema Fundamentals (High) - Embed vs reference, 16MB awareness, document model
- Relationship Patterns (High) - One-to-one, one-to-few, one-to-many, many-to-many, trees
- Design Patterns (Medium) - Bucket, computed, subset, outlier, extended reference
- Schema Validation (Medium) - JSON Schema, validation levels

### mongodb-query-and-index-optimize

MongoDB query optimization and indexing strategies from MongoDB Engineering. Contains **30 rules across 5 categories**, prioritized by impact.

**Use when:**
- Writing new MongoDB queries or aggregations
- Creating indexes for collections
- Debugging slow queries (COLLSCAN, high execution time)
- Reviewing explain() output
- Optimizing aggregation pipelines

**Categories covered:**
- Index Essentials (Critical) - ESR rule, compound field order, covered queries, prefix principle
- Specialized Indexes (High) - Partial, sparse, TTL, text, wildcard, multikey, geospatial
- Query Patterns (High) - Projections, batch operations, pagination, $exists behavior
- Aggregation Optimization (High) - $match early, $sort+$limit, indexed $lookup, allowDiskUse
- Performance Diagnostics (Medium) - explain() interpretation, slow query profiler, $indexStats

## Installation

### Option 1: Agent Skills CLI (works with 15+ agents)

```bash
npx add-skill romiluz13/mongodb-agent-skills
```

Supports: OpenCode, Claude Code, Codex, Cursor, Amp, Kilo Code, Roo Code, Goose, Gemini CLI, Antigravity, GitHub Copilot, Clawdbot, Droid, Windsurf, and more.

### Option 2: Claude Code Plugin Marketplace

```bash
# Step 1: Add marketplace
/plugin marketplace add romiluz13/mongodb-agent-skills

# Step 2: Install plugin (includes all skills)
/plugin install mongodb-agent-skills@mongodb-agent-skills

# Step 3: Restart Claude Code
```

## Usage

Skills are automatically available once installed. The agent will use them when relevant tasks are detected.

**Examples:**
```
Design a schema for an e-commerce application
```
```
Why is this MongoDB query slow?
```
```
Review this aggregation pipeline for performance
```
```
Should I embed or reference this data?
```

## Structure

```
mongodb-agent-skills/
├── skills/                              # agentskills.io format (symlinks)
│   ├── mongodb-schema-design/
│   └── mongodb-query-and-index-optimize/
├── .claude-plugin/
│   └── marketplace.json                 # Anthropic plugin marketplace
└── plugins/
    └── mongodb-agent-skills/
        ├── .claude-plugin/
        │   └── plugin.json
        └── skills/                      # Actual skill files
            ├── mongodb-schema-design/
            │   ├── SKILL.md
            │   ├── AGENTS.md
            │   ├── rules/
            │   └── metadata.json
            └── mongodb-query-and-index-optimize/
                ├── SKILL.md
                ├── AGENTS.md
                ├── rules/
                └── metadata.json
```

## License

Apache-2.0
