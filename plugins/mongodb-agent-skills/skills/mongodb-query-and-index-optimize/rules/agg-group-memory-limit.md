---
title: Control $group Memory Usage
impact: HIGH
impactDescription: "Prevents aggregation failures by keeping memory usage under limits"
tags: aggregation, group, memory, allowDiskUse, pipeline-limits
---

## Control $group Memory Usage

**$group is one of the most memory-intensive stages.** If your grouping set is large or you push entire documents into arrays, you can hit the 100MB memory limit. Reduce input size early and avoid unbounded accumulators.

**Incorrect (grouping full documents into arrays):**

```javascript
// Collecting full documents explodes memory

db.orders.aggregate([
  { $group: { _id: "$customerId", orders: { $push: "$$ROOT" } } }
])
// Risk: 100MB limit exceeded
```

**Correct (project only needed fields + aggregate scalars):**

```javascript
// Keep only required fields and use scalar accumulators

db.orders.aggregate([
  { $project: { customerId: 1, total: 1 } },
  { $group: { _id: "$customerId", spend: { $sum: "$total" } } }
], { allowDiskUse: true })
```

**When NOT to use this pattern:**

- **Small datasets**: Memory limits are unlikely to be hit.
- **You actually need full documents**: Consider a $lookup after grouping.

**Verify with:**

```javascript
// Check if aggregation spills to disk

db.orders.explain("executionStats").aggregate([
  { $group: { _id: "$customerId", spend: { $sum: "$total" } } }
])
```

---

## Before You Implement

**I recommend projecting fields early and using scalar accumulators to control $group memory, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Group cardinality | High cardinality = more memory for group keys | `db.collection.distinct("groupField").length` |
| Document size entering $group | Large docs x groups = memory explosion | Check $project stage before $group |
| Accumulator types used | $push "$$ROOT" is memory-intensive | Review your $group accumulators |

**Verification query:**
```javascript
// Estimate $group memory usage
const groupField = "customerId"
const uniqueKeys = db.collection.aggregate([
  { $group: { _id: `$${groupField}` } },
  { $count: "uniqueKeys" }
]).toArray()[0]?.uniqueKeys || 0
print(`Unique group keys: ${uniqueKeys}`)
print(`Estimated memory: ${uniqueKeys > 100000 ? "HIGH RISK" : "Likely OK"}`)
```

**Interpretation:**
- Good result: <100K unique groups with scalar accumulators - Should fit in memory
- Warning result: >100K groups or using $push - Monitor for disk spills
- Bad result: Millions of groups or $push "$$ROOT" - Refactor pipeline

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__aggregate` - Count unique group keys
- `mcp__mongodb__explain` - Check if $group spills to disk
- `mcp__mongodb__collection-schema` - Estimate document sizes

**Just ask:** "Can you check if my $group on [field] will fit in memory for [collection]?"

---

Reference: [Aggregation Pipeline Limits](https://mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
