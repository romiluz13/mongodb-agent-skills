---
title: Rule Title Here
impact: CRITICAL|HIGH|MEDIUM
impactDescription: Brief description of measurable impact
tags: tag1, tag2, tag3
---

## Rule Title Here

Brief explanation of why this rule matters and what problem it solves.

**Incorrect (description of the problem):**

```javascript
// Bad code example using MongoDB Shell syntax
db.collection.find({ field: "value" })
```

**Correct (description of the solution):**

```javascript
// Good code example using MongoDB Shell syntax
db.collection.find({ field: "value" })
```

Optional additional context, variations, or edge cases.

**When NOT to use this pattern:**

- Exception scenario 1 where this rule doesn't apply
- Exception scenario 2 where the trade-off isn't worth it

---

## ⚠️ Before You Implement

**I recommend this based on patterns, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Check 1 | Reason 1 | `db.collection.command()` |
| Check 2 | Reason 2 | `db.collection.command()` |

**Verification command:**
```javascript
// Command to verify before implementing
db.collection.getIndexes()
```

**Interpretation:**
- ✅ Result A: Safe to proceed
- ⚠️ Result B: Consider alternatives
- 🔴 Result C: Do not implement

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check existing indexes
- `mcp__mongodb__explain` - Analyze current query performance

**Just ask:** "Verify this recommendation for my [collection] collection"

---

Reference: [MongoDB Documentation](https://mongodb.com/docs/manual/)
