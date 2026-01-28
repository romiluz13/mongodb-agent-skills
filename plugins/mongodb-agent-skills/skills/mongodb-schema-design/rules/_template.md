---
title: Rule Title Here
impact: CRITICAL|HIGH|MEDIUM
impactDescription: "Specific quantified impact: 10-100× improvement, 16MB limit avoided, 50ms→5ms"
tags: tag1, tag2, tag3
---

## Rule Title Here

**1-2 sentence explanation of WHY this matters with specific impact metrics.** Example: "This pattern prevents X which causes Y, improving performance by Z×."

**Incorrect (description of the problem):**

```javascript
// Bad code example with inline comments explaining the issue
// Metric: "Results in X behavior, Y impact"
db.collection.find({ field: "value" })
```

Brief explanation of what goes wrong with this approach and why.

**Correct (description of the solution):**

```javascript
// Good code example with inline comments explaining the fix
// Metric: "Results in X behavior, Y improvement"
db.collection.find({ field: "value" })
```

Brief explanation of why this solution works better.

**Alternative approach (when applicable):**

```javascript
// Alternative solution for specific use cases
db.collection.find({ field: "value" })
```

Explanation of when to use this alternative instead.

**When NOT to use this pattern:**

- Exception scenario 1 where this rule doesn't apply
- Exception scenario 2 where the trade-off isn't worth it
- Edge case that requires different handling

---

## ⚠️ Before You Implement

**I analyzed your code pattern, but couldn't verify actual data. Please check:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Check 1 | Reason 1 | `db.collection.aggregate([...])` |
| Check 2 | Reason 2 | `db.collection.stats()` |
| Check 3 | Reason 3 | See query below |

**Verification query:**
```javascript
// Diagnostic command to confirm the issue or verify the fix
db.collection.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: { _id: null, maxSize: { $max: "$size" }, avgSize: { $avg: "$size" } } }
])
```

**Interpretation:**
- ✅ Result A: Your data is fine, no restructuring needed
- ⚠️ Result B: Consider this optimization
- 🔴 Result C: Recommend restructuring

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-schema` - Infer current schema structure
- `mcp__mongodb__aggregate` - Measure document/array sizes

**Just ask:** "Analyze [field] in my [collection] collection"

---

Reference: [MongoDB Documentation](https://mongodb.com/docs/manual/...)
