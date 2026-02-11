```
                    ╔═══════════════════════════════════════════════════════════════╗
                    ║                                                               ║
    { }    [ ]      ║   ███╗   ███╗ ██████╗ ███╗   ██╗ ██████╗  ██████╗ ██████╗    ║      &&    //
                    ║   ████╗ ████║██╔═══██╗████╗  ██║██╔════╝ ██╔═══██╗██╔══██╗   ║
   < / >    ||      ║   ██╔████╔██║██║   ██║██╔██╗ ██║██║  ███╗██║   ██║██║  ██║   ║    { }   [ ]
                    ║   ██║╚██╔╝██║██║   ██║██║╚██╗██║██║   ██║██║   ██║██║  ██║   ║
    ( )    !!       ║   ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║╚██████╔╝╚██████╔╝██████╔╝   ║     =>   /*
                    ║   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═════╝    ║
    =>     /*       ║                    A G E N T   S K I L L S                   ║    < / >   !!
                    ║                                                               ║
                    ╚═══════════════════════════════════════════════════════════════╝
```

<div align="center">

**Stop writing slow MongoDB code. Build AI that works.**

*109 rules. Battle-tested patterns.*
*The difference between 10 seconds and 10 milliseconds.*
*The bridge between AI assistants and MongoDB's latest features.*

[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-compatible-00ED64?style=for-the-badge)](https://agentskills.io/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-00ED64?style=for-the-badge)](https://claude.ai)
[![License](https://img.shields.io/badge/License-Apache%202.0-001E2B?style=for-the-badge)](LICENSE)

</div>

---

## `>_ The Problem`

```javascript
// Every MongoDB performance issue follows the same patterns:

db.orders.find({ status: "pending" })           // COLLSCAN on 10M documents
db.users.findOne({ _id })                       // Document hit 16MB limit
db.posts.aggregate([{ $lookup: ... }])          // N+1 queries, no index
db.logs.aggregate([{ $group: ... }])            // Memory exhaustion, no $match

// These skills catch these problems BEFORE production.
```

---

## `{ } Available Skills`

<table>
<tr>
<td width="50%" valign="top">

### `mongodb-schema-design`

```
┌─────────────────────────────────────┐
│  30 RULES FOR DATA MODELING        │
│  THAT SCALES                        │
└─────────────────────────────────────┘
```

**Use when:**
- Designing a new schema
- Migrating from SQL
- Embed vs reference decisions
- Hitting the 16MB limit

| Category | Impact |
|----------|--------|
| Anti-Patterns | `CRITICAL` |
| Fundamentals | `HIGH` |
| Relationships | `HIGH` |
| Design Patterns | `MEDIUM` |
| Validation | `MEDIUM` |

</td>
<td width="50%" valign="top">

### `mongodb-query-and-index-optimize`

```
┌─────────────────────────────────────┐
│  46 RULES FOR QUERIES THAT FLY     │
│  COLLSCAN → IXSCAN                  │
└─────────────────────────────────────┘
```

**Use when:**
- Writing queries or aggregations
- Creating indexes
- Debugging slow queries
- Reading explain() output

| Category | Impact |
|----------|--------|
| Index Essentials | `CRITICAL` |
| Specialized Indexes | `HIGH` |
| Query Patterns | `HIGH` |
| Aggregation | `HIGH` |
| Diagnostics | `MEDIUM` |

</td>
</tr>
<tr>
<td colspan="2" valign="top">

### `mongodb-ai`

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│  33 RULES FOR VECTOR SEARCH & AI                                                  │
│  THE KNOWLEDGE AI ASSISTANTS DON'T HAVE                                           │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Use when:**
- Creating vector indexes
- Writing $vectorSearch queries
- Building RAG applications
- Implementing hybrid search ($rankFusion)
- Storing AI agent memory
- Multi-tenant vector search

| Category | Impact |
|----------|--------|
| Vector Index Creation | `CRITICAL` |
| $vectorSearch Queries | `CRITICAL` |
| Performance Tuning | `HIGH` |
| RAG Patterns | `HIGH` |
| Hybrid Search | `MEDIUM` |
| AI Agent Integration | `MEDIUM` |

> **Why this skill matters:** AI assistants have knowledge cutoffs and cannot correctly help with MongoDB Vector Search. This skill bridges that gap with the latest syntax for `$vectorSearch`, quantization, `$rankFusion`, and more.

</td>
</tr>
</table>

---

## `=>  Installation`

### Option 1: Claude Code Plugin (Easiest)

```bash
# Add marketplace
/plugin marketplace add romiluz13/mongodb-agent-skills

# Install
/plugin install mongodb-agent-skills@mongodb-agent-skills
```

### Option 2: MongoDB Skills CLI

Works with **Claude Code, Codex, Cursor, and 35+ other agents**.

```bash
# Install all MongoDB skills
npx skills add romiluz13/mongodb-agent-skills --skill '*' -a claude-code -a codex -a cursor

# Install one skill only
npx skills add romiluz13/mongodb-agent-skills --skill mongodb-ai -a claude-code -a codex -a cursor

# Remove all installed skills from this repo (if needed)
npx skills remove romiluz13/mongodb-agent-skills --skill '*' -a claude-code -a codex -a cursor -y
```

### Verify Installation

```bash
# Show installed skills for target agents
npx skills list -a claude-code -a codex -a cursor

# Check for updates later
npx skills check
```

---

## `/* Usage */`

Once installed, skills activate automatically. Just ask:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  > Design a schema for an e-commerce app                                     │
│                                                                              │
│  > Why is this query slow? db.orders.find({ status: "pending" })             │
│                                                                              │
│  > Review this aggregation pipeline for performance                          │
│                                                                              │
│  > Should I embed order items or reference them?                             │
│                                                                              │
│  > Create indexes for this collection                                        │
│                                                                              │
│  > Create a vector index for semantic search                                 │
│                                                                              │
│  > Implement RAG with MongoDB                                                │
│                                                                              │
│  > How do I tune numCandidates for vector search?                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## `// What Makes These Different`

```
┌────────────────────┬─────────────────────────────────────────────────────────┐
│ QUANTIFIED IMPACT  │ Every rule shows the performance difference (10x, 100x) │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ REAL CODE          │ Bad patterns with metrics → fixed versions that work    │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ WHEN NOT TO USE    │ Every pattern has exceptions. We tell you what they are │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ VERIFICATION       │ explain() queries to prove the optimization worked      │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

---

<div align="center">

```
        { }                 [ ]                 =>                  &&

             "The patterns MongoDB Engineers use to build
                    applications that scale."

        < / >               !!                  /*                  ||
```

**[View on GitHub](https://github.com/romiluz13/mongodb-agent-skills)** · **[Report Issue](https://github.com/romiluz13/mongodb-agent-skills/issues)** · **[agentskills.io](https://agentskills.io/)**

Apache-2.0

</div>
