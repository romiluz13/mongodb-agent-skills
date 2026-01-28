---
title: Understand Index Prefix Principle
impact: CRITICAL
impactDescription: "One { a: 1, b: 1, c: 1 } index serves queries on a, a+b, and a+b+c—saves 2 redundant indexes"
tags: index, compound, prefix, optimization, redundancy, fundamentals
---

## Understand Index Prefix Principle

**A compound index supports queries on any prefix of its fields—you don't need separate indexes.** Index `{ a: 1, b: 1, c: 1 }` supports queries on `{ a }`, `{ a, b }`, and `{ a, b, c }`. Understanding this eliminates redundant indexes that waste RAM, slow writes, and complicate maintenance. The flip side: queries on `{ b }`, `{ c }`, or `{ b, c }` cannot use this index at all.

**Incorrect (redundant indexes—wasted resources):**

```javascript
// Common mistake: Creating overlapping indexes
db.orders.createIndex({ customerId: 1 })                    // Index 1
db.orders.createIndex({ customerId: 1, status: 1 })        // Index 2
db.orders.createIndex({ customerId: 1, status: 1, date: -1 }) // Index 3

// Query support:
// - find({ customerId: x }) → Uses Index 1, 2, OR 3
// - find({ customerId: x, status: y }) → Uses Index 2 OR 3
// - find({ customerId: x, status: y, date: z }) → Uses Index 3 only

// Problem: Index 1 and Index 2 are REDUNDANT
// Index 3 already covers all their use cases!

// Cost of redundancy:
// - 3 indexes instead of 1
// - 3× write overhead (each insert/update touches 3 indexes)
// - 3× RAM usage for index pages
// - 3× maintenance during compaction
```

**Correct (single compound index—prefix coverage):**

```javascript
// Single index covers all three query patterns
db.orders.createIndex({ customerId: 1, status: 1, date: -1 })

// Prefix coverage:
// - { customerId: 1 } ← First field prefix
//   find({ customerId: "cust123" }) ✓ USES INDEX
//
// - { customerId: 1, status: 1 } ← Two-field prefix
//   find({ customerId: "cust123", status: "completed" }) ✓ USES INDEX
//
// - { customerId: 1, status: 1, date: -1 } ← Full index
//   find({ customerId: "cust123", status: "completed", date: { $gte: d } }) ✓ USES INDEX

// NOT supported (non-prefixes):
// - { status: 1 } ← Not a prefix (doesn't start with customerId)
//   find({ status: "completed" }) ✗ COLLSCAN
//
// - { date: 1 } ← Not a prefix
//   find({ date: { $gte: d } }) ✗ COLLSCAN
//
// - { status: 1, date: 1 } ← Not a prefix (skips customerId)
//   find({ status: "completed", date: { $gte: d } }) ✗ COLLSCAN
```

**Prefix principle visualized:**

```javascript
// Index: { a: 1, b: 1, c: 1, d: 1 }
//
// Valid prefixes (can use this index):
// ┌───┬───┬───┬───┐
// │ a │   │   │   │ ✓ Prefix: {a}
// ├───┼───┼───┼───┤
// │ a │ b │   │   │ ✓ Prefix: {a, b}
// ├───┼───┼───┼───┤
// │ a │ b │ c │   │ ✓ Prefix: {a, b, c}
// ├───┼───┼───┼───┤
// │ a │ b │ c │ d │ ✓ Full index: {a, b, c, d}
// └───┴───┴───┴───┘
//
// Invalid (NOT prefixes - cannot use this index):
// ┌───┬───┬───┬───┐
// │   │ b │   │   │ ✗ Skips 'a'
// ├───┼───┼───┼───┤
// │   │   │ c │   │ ✗ Skips 'a', 'b'
// ├───┼───┼───┼───┤
// │ a │   │ c │   │ ✗ Skips 'b' (must be contiguous)
// ├───┼───┼───┼───┤
// │   │ b │ c │ d │ ✗ Skips 'a'
// └───┴───┴───┴───┘
```

**Index consolidation strategy:**

```javascript
// Before: Multiple overlapping indexes
db.products.getIndexes()
// { category: 1 }
// { category: 1, brand: 1 }
// { category: 1, brand: 1, price: 1 }
// { category: 1, price: 1 }  ← This one is NOT covered!

// Analysis:
// - { category: 1 } is prefix of { category: 1, brand: 1, price: 1 }
// - { category: 1, brand: 1 } is prefix of { category: 1, brand: 1, price: 1 }
// - { category: 1, price: 1 } is NOT a prefix (skips brand)

// After: Optimal index set
db.products.dropIndex({ category: 1 })
db.products.dropIndex({ category: 1, brand: 1 })
// Keep: { category: 1, brand: 1, price: 1 }
// Keep: { category: 1, price: 1 } ← Still needed, different field order

// Result: 2 indexes instead of 4 (50% reduction)
```

**Prefix principle with sort:**

```javascript
// Index: { status: 1, createdAt: -1 }

// Queries using prefix:
db.orders.find({ status: "pending" }).sort({ createdAt: -1 })
// ✓ Both filter (status) and sort (createdAt) use index

db.orders.find({ status: "pending" })
// ✓ Filter uses prefix

// Sort-only queries:
db.orders.find().sort({ status: 1, createdAt: -1 })
// ✓ Sort uses full index (no filter needed for sort)

db.orders.find().sort({ createdAt: -1 })
// ✗ Cannot use index - sort field not at prefix position
// Must scan full index or do in-memory sort

// Key insight: For sort-only, first sort field must be at index start
```

**Common prefix mistakes:**

```javascript
// Mistake 1: Creating index for every query variation
// BAD:
db.users.createIndex({ tenantId: 1 })
db.users.createIndex({ tenantId: 1, email: 1 })
db.users.createIndex({ tenantId: 1, email: 1, status: 1 })

// GOOD: Single compound index
db.users.createIndex({ tenantId: 1, email: 1, status: 1 })

// Mistake 2: Thinking field ORDER doesn't matter
// These are DIFFERENT indexes with different prefixes:
db.orders.createIndex({ status: 1, date: 1 })
// Prefix: {status}, {status, date}

db.orders.createIndex({ date: 1, status: 1 })
// Prefix: {date}, {date, status}

// Choose based on your most common query patterns

// Mistake 3: Forgetting sort fields affect prefix usage
db.orders.createIndex({ status: 1, amount: 1 })
db.orders.find({ status: "pending" }).sort({ date: -1 })
// ✗ date not in index → in-memory sort!

// Fix: Include sort field
db.orders.createIndex({ status: 1, date: -1, amount: 1 })
```

**When to create non-prefix indexes:**

- **Different leading field needed**: Queries filter on different fields first.
- **Different sort orders**: Ascending vs descending sorts (can't flip multi-field sort).
- **Covered query optimization**: Different projections need different field combinations.
- **Cardinality considerations**: Sometimes a different leading field is more selective.

**Verify with:**

```javascript
// Find redundant indexes (covered by prefixes of other indexes)
function findRedundantIndexes(collection) {
  const indexes = db[collection].getIndexes().filter(idx => idx.name !== "_id_")

  const redundant = []

  for (const idx of indexes) {
    const idxFields = Object.keys(idx.key)

    for (const other of indexes) {
      if (idx.name === other.name) continue

      const otherFields = Object.keys(other.key)

      // Check if idx is a prefix of other
      if (idxFields.length < otherFields.length) {
        const isPrefix = idxFields.every((field, i) =>
          field === otherFields[i] && idx.key[field] === other.key[field]
        )

        if (isPrefix) {
          redundant.push({
            redundantIndex: idx.name,
            coveredBy: other.name,
            reason: `${idx.name} is a prefix of ${other.name}`
          })
        }
      }
    }
  }

  if (redundant.length === 0) {
    print("No redundant indexes found ✓")
  } else {
    print(`Found ${redundant.length} redundant index(es):`)
    redundant.forEach(r => {
      print(`\n  DROP: ${r.redundantIndex}`)
      print(`  Covered by: ${r.coveredBy}`)
    })
  }

  return redundant
}

// Usage
findRedundantIndexes("orders")
```

---

## Before You Implement

**I recommend consolidating redundant indexes using prefix coverage, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current compound indexes | Need to see existing index structure | `db.collection.getIndexes()` |
| Query patterns in profiler | Ensure removed indexes won't break queries | `db.system.profile.find()` |
| Index usage statistics | Identify which indexes are actually used | `db.collection.aggregate([{$indexStats:{}}])` |

**Verification query:**
```javascript
// Find redundant indexes covered by compound index prefixes
db.collection.getIndexes().forEach(idx => {
  print(`Index: ${idx.name}, Keys: ${JSON.stringify(idx.key)}`)
})
```

**Interpretation:**
- Good result: Clear prefix hierarchy, no overlapping single-field indexes - Safe to consolidate
- Warning result: Multiple indexes with same leading field - Review query patterns first
- Bad result: Index usage stats show all indexes heavily used - Investigate before dropping

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - View all current indexes on the collection
- `mcp__mongodb__aggregate` with $indexStats - Check actual index usage patterns
- `mcp__mongodb__find` on system.profile - Identify query patterns using each index

**Just ask:** "Can you check my current indexes on [collection] and identify any redundant ones based on prefix coverage?"

---

Reference: [Compound Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-compound/)
