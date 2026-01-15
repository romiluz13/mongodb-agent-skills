# MongoDB Agent Skills

A collection of skills for AI coding agents. Skills are packaged instructions that extend agent capabilities for MongoDB development.

Skills follow the [Agent Skills](https://agentskills.io/) format.

## Available Skills

### mongodb-schema-design

MongoDB data modeling patterns and anti-patterns from MongoDB Engineering. Contains 12 rules across 3 categories, prioritized by impact.

**Use when:**
- Designing a new MongoDB schema
- Migrating from SQL to MongoDB
- Reviewing existing data models
- Troubleshooting slow queries caused by schema issues
- Deciding between embedding and referencing

**Categories covered:**
- Schema Anti-Patterns (Critical) - Unbounded arrays, bloated documents, excessive collections
- Schema Fundamentals (High) - Embed vs reference, data access patterns
- Design Patterns (Medium) - Bucket, extended reference, subset patterns

### mongodb-query-and-index-optimize

MongoDB query optimization and indexing strategies from MongoDB Engineering. Contains 15 rules across 3 categories, prioritized by impact.

**Use when:**
- Writing new MongoDB queries or aggregations
- Creating indexes for collections
- Debugging slow queries (COLLSCAN, high execution time)
- Reviewing explain() output
- Optimizing aggregation pipelines

**Categories covered:**
- Index Strategies (Critical) - Compound field order, ensure index usage, covered queries
- Query Patterns (High) - Projections, batch operations, pagination
- Aggregation Optimization (High) - $match early, $sort+$limit, indexed $lookup

## Installation

### Option 1: Claude Code (Personal Skills)

Install skills for use across all your projects:

```bash
# Clone the repository
git clone https://github.com/romiluz13/mongodb-agent-skills.git

# Copy to your personal skills directory
cp -r mongodb-agent-skills/skills/mongodb-schema-design ~/.claude/skills/
cp -r mongodb-agent-skills/skills/mongodb-query-and-index-optimize ~/.claude/skills/
```

Skills are automatically discovered by Claude Code. No restart required.

### Option 2: Claude Code (Project Skills)

Install skills for a specific project (shared with your team via git):

```bash
# From your project root
mkdir -p .claude/skills

# Clone and copy
git clone https://github.com/romiluz13/mongodb-agent-skills.git /tmp/mongodb-skills
cp -r /tmp/mongodb-skills/skills/mongodb-schema-design .claude/skills/
cp -r /tmp/mongodb-skills/skills/mongodb-query-and-index-optimize .claude/skills/
rm -rf /tmp/mongodb-skills

# Commit to share with team
git add .claude/skills
git commit -m "Add MongoDB agent skills"
```

### Option 3: Claude.ai (Project Knowledge)

1. Download the `SKILL.md` file:
   - [mongodb-schema-design/SKILL.md](skills/mongodb-schema-design/SKILL.md)
   - [mongodb-query-and-index-optimize/SKILL.md](skills/mongodb-query-and-index-optimize/SKILL.md)
2. In Claude.ai, go to your Project → Project Knowledge
3. Upload the `SKILL.md` file(s)

### Option 4: Community CLI

Using the [Agent Skills CLI](https://agentskills.io/):

```bash
npx add-skill romiluz13/mongodb-agent-skills
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

## Skill Structure

Each skill contains:
- `SKILL.md` - Instructions for the agent
- `rules/` - Individual rule files with code examples
- `metadata.json` - Skill metadata and references

## License

Apache-2.0
