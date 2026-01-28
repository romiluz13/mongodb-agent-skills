---
title: Put High-Cardinality Fields First in Equality Conditions
impact: HIGH
impactDescription: "6,000× fewer keys examined—low cardinality first scans millions, high cardinality first scans hundreds"
tags: index, cardinality, selectivity, compound-index, performance, equality
---

## Put High-Cardinality Fields First in Equality Conditions

**For multiple equality fields, put the highest cardinality (most unique values) field first.** Cardinality determines how quickly the index narrows results. A field with 100,000 unique values eliminates 99.999% of documents on first lookup; a field with 5 values only eliminates 80%. This ordering can mean the difference between scanning 500 index entries vs 3 million.

**Incorrect (low cardinality first—scans millions):**

```javascript
// Query: Find orders by status and customerId
db.orders.find({ status: "completed", customerId: "cust123" })

// BAD index: status first (only 5 distinct values)
db.orders.createIndex({ status: 1, customerId: 1 })

// What happens on 10M orders:
// 1. Jump to status="completed" → matches 3M documents (30% of collection)
// 2. Within those 3M, scan for customerId="cust123" → finds 500 matches
// Result: totalKeysExamined = 3,000,000 to find 500 documents

// explain() shows:
{
  "totalKeysExamined": 3000000,   // Scanned 3M index entries!
  "totalDocsExamined": 500,
  "nReturned": 500,
  "executionTimeMillis": 1200     // Over a second
}
```

**Correct (high cardinality first—scans hundreds):**

```javascript
// GOOD index: customerId first (100K distinct values)
db.orders.createIndex({ customerId: 1, status: 1 })

// What happens:
// 1. Jump to customerId="cust123" → matches 500 documents (0.005% of collection)
// 2. Within those 500, filter status="completed" → finds 350 matches
// Result: totalKeysExamined = 500 to find 350 documents

// explain() shows:
{
  "totalKeysExamined": 500,       // Only 500 index entries!
  "totalDocsExamined": 350,
  "nReturned": 350,
  "executionTimeMillis": 2        // 2 milliseconds
}

// Same query, 600× fewer keys examined, 600× faster
```

**Understanding selectivity (the math):**

```javascript
// Selectivity = 1 / number of distinct values
// Higher selectivity = better for leading position

// Example with 10M orders:
// status: 5 distinct → selectivity = 0.2 → matches ~2M docs
// customerId: 100K distinct → selectivity = 0.00001 → matches ~100 docs
// orderId: 10M distinct (unique) → selectivity = 0.0000001 → matches 1 doc

// Rule: Put highest selectivity (lowest match count) first
```

**Cardinality reference table:**

| Field Type | Example Field | Typical Cardinality | Selectivity |
|------------|--------------|---------------------|-------------|
| Unique ID | `_id`, `orderId` | = doc count | Perfect |
| User identifier | `userId`, `email` | High (100K+) | Excellent |
| Timestamp | `createdAt` | High | Excellent |
| Category | `category`, `department` | Medium (10-1000) | Good |
| Status | `status`, `state` | Low (3-10) | Poor |
| Boolean | `isActive`, `isDeleted` | Very low (2) | Very poor |
| Constant | `type: "order"` | 1 | Useless |

**Measuring cardinality:**

```javascript
// Quick cardinality check
db.orders.distinct("status").length        // 5
db.orders.distinct("customerId").length    // 100000
db.orders.distinct("region").length        // 12

// For very large collections, estimate with aggregation
db.orders.aggregate([
  { $group: { _id: "$status" } },
  { $count: "distinctCount" }
])  // { distinctCount: 5 }

// Full cardinality analysis for multiple fields
db.orders.aggregate([
  { $facet: {
    status: [{ $group: { _id: "$status" } }, { $count: "n" }],
    customerId: [{ $group: { _id: "$customerId" } }, { $count: "n" }],
    region: [{ $group: { _id: "$region" } }, { $count: "n" }]
  }}
])
// Returns: { status: [{n: 5}], customerId: [{n: 100000}], region: [{n: 12}] }
// Order: customerId > region > status
```

**Real-world example—multi-tenant SaaS:**

```javascript
// Query: Find active users for a tenant
db.users.find({
  tenantId: "tenant123",     // ~1000 distinct (1000 customers)
  status: "active",          // ~3 distinct (active/inactive/pending)
  role: "admin"              // ~5 distinct (admin/user/viewer/etc)
})

// Calculate expected matches at each level (100K total users):
// tenantId first: 100K / 1000 = 100 users → then filter status/role
// status first: 100K / 3 = 33,333 users → then filter tenantId/role
// role first: 100K / 5 = 20,000 users → then filter tenantId/status

// Best index order (highest cardinality first):
db.users.createIndex({ tenantId: 1, role: 1, status: 1 })
// Narrows to ~100 on first lookup, then ~20, then ~15
```

**When NOT to put high cardinality first:**

- **ESR rule takes precedence**: If you have Sort in query, ESR order (Equality→Sort→Range) beats pure cardinality optimization.
- **Index reuse across queries**: If one query needs `{status}` alone and another needs `{status, customerId}`, putting status first serves both.
- **Covered query requirements**: Projection fields may need specific index positions.
- **Near-equal cardinality**: If fields have similar cardinality, prefer the one queried more often as leading field.

**Verify with:**

```javascript
// Compare index efficiency for different orderings
function compareIndexOrder(collection, query, index1, index2) {
  // Create both indexes
  db[collection].createIndex(index1, { name: "test_order_1" })
  db[collection].createIndex(index2, { name: "test_order_2" })

  // Test with first index
  const explain1 = db[collection].find(query)
    .hint("test_order_1")
    .explain("executionStats")

  // Test with second index
  const explain2 = db[collection].find(query)
    .hint("test_order_2")
    .explain("executionStats")

  print("Index 1:", JSON.stringify(index1))
  print("  Keys examined:", explain1.executionStats.totalKeysExamined)
  print("  Time:", explain1.executionStats.executionTimeMillis, "ms")

  print("Index 2:", JSON.stringify(index2))
  print("  Keys examined:", explain2.executionStats.totalKeysExamined)
  print("  Time:", explain2.executionStats.executionTimeMillis, "ms")

  // Cleanup
  db[collection].dropIndex("test_order_1")
  db[collection].dropIndex("test_order_2")
}

// Usage
compareIndexOrder(
  "orders",
  { status: "completed", customerId: "cust123" },
  { status: 1, customerId: 1 },    // Low cardinality first
  { customerId: 1, status: 1 }     // High cardinality first
)
```

---

## ⚠️ Before You Implement

**I recommend reordering fields by cardinality, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Measure actual cardinality | Don't assume - verify | See analysis query |
| Check existing indexes | May already have optimal order | `db.collection.getIndexes()` |
| Consider ESR rule | Sort fields may override cardinality | Review query patterns |

**Measure cardinality:**
```javascript
db.collection.aggregate([
  { $facet: {
    field1: [{ $group: { _id: "$field1" } }, { $count: "n" }],
    field2: [{ $group: { _id: "$field2" } }, { $count: "n" }]
  }}
])
// Higher n = higher cardinality = should come first
```

**Interpretation:**
- ✅ Clear cardinality difference (10x+): Reorder recommended
- ⚠️ Similar cardinality: Order may not matter much
- 🔴 Query has sort: ESR rule takes precedence over cardinality

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check existing index field order
- `mcp__mongodb__aggregate` - Measure cardinality of fields

**Just ask:** "Analyze cardinality for index fields on [collection]"

---

Reference: [Index Selectivity](https://mongodb.com/docs/manual/tutorial/create-queries-that-ensure-selectivity/)
