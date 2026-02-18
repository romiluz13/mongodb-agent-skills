---
title: Use Wildcard Indexes for Dynamic Fields
impact: HIGH
impactDescription: "Wildcard indexes help query dynamic field paths without predefining every field-specific index"
tags: index, wildcard, dynamic, polymorphic, attributes, flexible-schema
---

## Use Wildcard Indexes for Dynamic Fields

**Wildcard indexes are for unpredictable field paths.** They are useful when your schema is flexible and you cannot predefine all indexed paths (for example user-defined attributes).

**Incorrect (only explicit indexes for unknown future fields):**

```javascript
db.products.createIndex({ "attributes.brand": 1 })
db.products.createIndex({ "attributes.color": 1 })
// New attribute keys require new indexes and migrations.
```

**Correct (wildcard index on the dynamic subtree):**

```javascript
db.products.createIndex({ "attributes.$**": 1 })

// Supports many dynamic path predicates:
db.products.find({ "attributes.brand": "Dell" })
db.products.find({ "attributes.customField": "value" })
```

**Patterns:**

```javascript
// Entire document wildcard (can be large)
db.collection.createIndex({ "$**": 1 })

// Scoped wildcard (recommended when possible)
db.products.createIndex({ "attributes.$**": 1 })

// Compound wildcard (MongoDB 7.0+)
db.products.createIndex({ type: 1, "attributes.$**": 1 })
```

**Important limitations and caveats:**

- Wildcard indexes cannot support `$text` queries.
- A wildcard term can support one predicate path at a time in a single query shape.
- Sorting with wildcard indexes is supported only in restricted cases (same predicate field, non-array field, wildcard index chosen for predicate).
- Wildcard indexes can support covered queries, but only under strict conditions (single queried field, projection excludes `_id`, field is never an array).

**Practical strategy:**

- Use explicit indexes for high-frequency known paths.
- Use wildcard indexes for truly dynamic paths.
- Mix both when needed.

## Verify with

```javascript
function analyzeWildcardIndex(collection) {
  const indexes = db[collection].getIndexes()
  const wildcard = indexes.filter(i => Object.keys(i.key).some(k => k.includes("$**")))

  wildcard.forEach(i => print(JSON.stringify({ name: i.name, key: i.key })))

  const stats = db[collection].aggregate([{ $indexStats: {} }]).toArray()
  stats
    .filter(s => wildcard.some(i => i.name === s.name))
    .forEach(s => print(`${s.name}: ops=${s.accesses.ops} since=${s.accesses.since}`))
}
```

Reference: [Wildcard Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-wildcard/)
