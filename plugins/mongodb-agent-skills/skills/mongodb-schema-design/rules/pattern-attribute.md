---
title: Use Attribute Pattern for Sparse or Variable Fields
impact: MEDIUM
impactDescription: "Reduces sparse indexes and enables efficient search across many optional fields"
tags: schema, patterns, attribute, sparse-fields, indexing, flexible-schema
---

## Use Attribute Pattern for Sparse or Variable Fields

**If documents have many optional fields, move them into a key-value array.** This avoids dozens of sparse indexes and lets you query across attributes with a single multikey index.

**Incorrect (many optional fields and indexes):**

```javascript
// Many optional fields - most are null or missing
{
  _id: 1,
  name: "Bottle",
  color: "red",
  size: "M",
  material: "glass",
  // 20+ other optional fields
}

// Index explosion
// db.items.createIndex({ color: 1 })
// db.items.createIndex({ size: 1 })
// db.items.createIndex({ material: 1 })
```

**Correct (attribute pattern):**

```javascript
// Store optional fields as key-value pairs
{
  _id: 1,
  name: "Bottle",
  attributes: [
    { k: "color", v: "red" },
    { k: "size", v: "M" },
    { k: "material", v: "glass" }
  ]
}

// Single multikey index for all attributes

db.items.createIndex({ "attributes.k": 1, "attributes.v": 1 })

// Query for color = red

db.items.find({
  attributes: { $elemMatch: { k: "color", v: "red" } }
})
```

**When NOT to use this pattern:**

- **Fixed schema**: If fields are stable and always present.
- **Type-specific validation**: If each field needs strict schema rules.
- **Single-field queries only**: A normal field may be simpler and faster.

**Verify with:**

```javascript
// Ensure queries use the multikey index

db.items.find({
  attributes: { $elemMatch: { k: "material", v: "glass" } }
}).explain("executionStats")
```

---

## Before You Implement

**I recommend the attribute pattern for sparse fields, but please verify your field sparsity first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Count sparse/optional fields | Many optional fields = attribute pattern candidate | Analyze field presence |
| Check index count | Too many sparse indexes indicate need for pattern | List collection indexes |
| Measure field presence rates | Low presence rate = good attribute candidate | Sample document analysis |
| Review query patterns | Ensure attribute queries are supported | Check application queries |

**Verification query:**
```javascript
// Find sparse fields (fields present in < 50% of documents)
db.collection.aggregate([
  { $sample: { size: 1000 } },
  { $project: { fields: { $objectToArray: "$$ROOT" } } },
  { $unwind: "$fields" },
  { $group: {
    _id: "$fields.k",
    count: { $sum: 1 }
  }},
  { $project: {
    field: "$_id",
    presenceRate: { $divide: ["$count", 1000] }
  }},
  { $match: { presenceRate: { $lt: 0.5, $gt: 0 } } },
  { $sort: { presenceRate: 1 } }
])
// Fields with low presence rate are candidates for attribute pattern
```

**Interpretation:**
- Good result (few sparse fields, < 5 indexes): Current schema is fine
- Warning (10+ sparse fields or indexes): Consider attribute pattern
- Bad result (20+ sparse fields): Attribute pattern strongly recommended

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-schema` - Identify optional/sparse fields
- `mcp__mongodb__collection-indexes` - Count existing indexes
- `mcp__mongodb__aggregate` - Analyze field presence rates

**Just ask:** "Can you analyze my collection for sparse fields and tell me if the attribute pattern would help?"

---

Reference: [Attribute Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/group-data/attribute-pattern/)
