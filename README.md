# MongoDB Agent Skills

**Stop writing slow MongoDB code.** These skills teach AI coding agents the patterns that MongoDB Engineers use to build applications that scale.

53 rules. Battle-tested patterns. The difference between a query that takes 10 seconds and one that takes 10 milliseconds.

Skills follow the [Agent Skills](https://agentskills.io/) format and work with **15+ coding agents** including Claude Code, Cursor, Copilot, Codex, and more.

## The Problem

Every MongoDB performance issue we see follows the same patterns:
- **COLLSCAN on 10M documents** - missing or wrong indexes
- **16MB document limit hit** - unbounded arrays that grew forever
- **N+1 query patterns** - $lookup without indexes, fetching references one-by-one
- **Memory exhaustion** - aggregations that don't filter early

These skills catch these problems *before* they hit production.

## Available Skills

### mongodb-schema-design

**23 rules** for data modeling that scales. The patterns MongoDB Engineers recommend - and the anti-patterns that cause production incidents.

**Use when:**
- Designing a new schema
- Migrating from SQL to MongoDB
- Reviewing existing data models
- Deciding between embedding and referencing
- Hitting the 16MB document limit

**What you'll learn:**
| Category | Impact | Examples |
|----------|--------|----------|
| Anti-Patterns | Critical | Unbounded arrays, bloated documents, schema drift |
| Fundamentals | High | Embed vs reference, document model thinking |
| Relationships | High | One-to-many, many-to-many, tree structures |
| Design Patterns | Medium | Bucket, computed, subset, outlier |
| Validation | Medium | JSON Schema, validation levels |

### mongodb-query-and-index-optimize

**30 rules** for queries that fly. Turn collection scans into index scans. Turn seconds into milliseconds.

**Use when:**
- Writing queries or aggregations
- Creating indexes
- Debugging slow queries (COLLSCAN, high executionTimeMillis)
- Reading explain() output
- Optimizing aggregation pipelines

**What you'll learn:**
| Category | Impact | Examples |
|----------|--------|----------|
| Index Essentials | Critical | ESR rule, compound field order, covered queries |
| Specialized Indexes | High | Partial, sparse, TTL, text, wildcard, geospatial |
| Query Patterns | High | Projections, batch operations, pagination |
| Aggregation | High | $match early, $sort+$limit, indexed $lookup |
| Diagnostics | Medium | explain() interpretation, profiler, $indexStats |

## Installation

### Option 1: Agent Skills CLI

Works with 15+ agents (Claude Code, Cursor, Copilot, Codex, OpenCode, and more):

```bash
npx add-skill romiluz13/mongodb-agent-skills
```

### Option 2: Claude Code Plugin Marketplace

```bash
# Add marketplace
/plugin marketplace add romiluz13/mongodb-agent-skills

# Install
/plugin install mongodb-agent-skills@mongodb-agent-skills

# Restart Claude Code
```

## Usage

Once installed, skills activate automatically. Just ask:

```
Design a schema for an e-commerce app with products, orders, and users
```

```
Why is this query slow? db.orders.find({ status: "pending" })
```

```
Review this aggregation pipeline for performance
```

```
Should I embed order items or reference them?
```

```
Create indexes for this collection
```

## What Makes These Different

These aren't generic best practices. They're the specific patterns that MongoDB Engineers see separate fast applications from slow ones:

- **Quantified impact** - Every rule shows the performance difference (10x, 100x, etc.)
- **Real code examples** - Bad patterns with inline metrics, fixed versions that actually work
- **When NOT to use** - Every pattern has exceptions. We tell you what they are.
- **Verification commands** - explain() queries to prove the optimization worked

## Contributing

Found a pattern we missed? Open an issue or PR.

## License

Apache-2.0
