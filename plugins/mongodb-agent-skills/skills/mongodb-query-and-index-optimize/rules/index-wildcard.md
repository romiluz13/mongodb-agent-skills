---
title: Use Wildcard Indexes for Dynamic Fields
impact: HIGH
impactDescription: "Dynamic/polymorphic schemas: one wildcard index covers arbitrary field patterns vs N indexes"
tags: index, wildcard, dynamic, polymorphic, attributes, flexible-schema
---

## Use Wildcard Indexes for Dynamic Fields

**Wildcard indexes automatically index all fields (or fields matching a pattern) in documents with dynamic or polymorphic schemas.** When you store arbitrary key-value attributes like `{ attributes: { color: "red", size: "L", customField1: "x" } }`, you can't know all field names upfront. A wildcard index on `attributes.$**` indexes every field under attributes, enabling queries on any attribute without predefined indexes.

**Incorrect (trying to index unknown fields):**

```javascript
// Product catalog with dynamic attributes
// Different product types have different fields
{
  _id: "laptop1",
  type: "laptop",
  attributes: {
    brand: "Dell",
    screenSize: 15.6,
    ram: "16GB",
    processor: "Intel i7"
  }
}

{
  _id: "shirt1",
  type: "clothing",
  attributes: {
    brand: "Nike",
    size: "L",
    color: "blue",
    material: "cotton"
  }
}

// Problem: Can't create indexes for every possible attribute
db.products.createIndex({ "attributes.brand": 1 })
db.products.createIndex({ "attributes.color": 1 })
db.products.createIndex({ "attributes.size": 1 })
db.products.createIndex({ "attributes.screenSize": 1 })
// ... hundreds more?

// New attributes require new indexes
// Custom user-defined attributes impossible to predict
```

**Correct (wildcard index on dynamic fields):**

```javascript
// Wildcard index covers ALL fields under attributes
db.products.createIndex({ "attributes.$**": 1 })

// Now ALL attribute queries use this index:
db.products.find({ "attributes.brand": "Dell" })        // ✓ Uses index
db.products.find({ "attributes.color": "blue" })        // ✓ Uses index
db.products.find({ "attributes.customField": "value" }) // ✓ Uses index
db.products.find({ "attributes.any.nested.path": 1 })   // ✓ Uses index

// One index, unlimited fields
// New attributes automatically indexed without schema changes
```

**Wildcard index patterns:**

```javascript
// Pattern 1: All fields in entire document
db.collection.createIndex({ "$**": 1 })
// Indexes every field at every level
// WARNING: Can be very large!

// Pattern 2: All fields under specific path
db.products.createIndex({ "attributes.$**": 1 })
// Only indexes fields under "attributes"

// Pattern 3: Include/exclude specific paths
db.events.createIndex(
  { "$**": 1 },
  {
    wildcardProjection: {
      metadata: 1,      // Include metadata and its subfields
      tags: 1,          // Include tags
      _id: 0,           // Exclude _id (default excluded anyway)
      largeBlob: 0      // Exclude largeBlob
    }
  }
)
// Indexes metadata.*, tags, but NOT largeBlob

// Pattern 4: Compound with wildcard (MongoDB 7.0+)
db.products.createIndex({ type: 1, "attributes.$**": 1 })
// Query: { type: "laptop", "attributes.ram": "16GB" }
// Both fields use index!
```

**Query patterns with wildcard indexes:**

```javascript
// Wildcard index: { "attributes.$**": 1 }

// ✓ Queries that USE wildcard index:
db.products.find({ "attributes.brand": "Dell" })
db.products.find({ "attributes.size": { $in: ["S", "M", "L"] } })
db.products.find({ "attributes.price": { $gte: 100, $lte: 500 } })
db.products.find({ "attributes.nested.deep.field": "value" })

// ✗ Queries that CANNOT use wildcard index:
db.products.find({ "attributes": { brand: "Dell" } })
// Exact object match, not field query

db.products.find({ attributes: { $exists: true } })
// Checking existence of parent field, not contents

db.products.find({
  $or: [
    { "attributes.brand": "Dell" },
    { "attributes.brand": "HP" }
  ]
})
// Uses index for each clause, but may choose COLLSCAN if OR is large

// CRITICAL: Wildcard indexes don't support:
// - Queries on the indexed field's parent document
// - Sorting on wildcard paths (can't sort by "attributes.unknown")
// - Covered queries (must fetch document)
```

**Wildcard vs explicit indexes:**

```javascript
// Explicit index: { "attributes.brand": 1 }
// - Faster for queries on "attributes.brand" specifically
// - Supports sorting on "attributes.brand"
// - Smaller (single field)
// - Must know field names upfront

// Wildcard index: { "attributes.$**": 1 }
// - Slightly slower per-query (more general)
// - Cannot sort on wildcard fields
// - Larger (all fields)
// - Works for ANY field, including unknown ones

// Best practice: Use explicit indexes for known, frequent queries
// Use wildcard for truly dynamic/user-defined fields

// Hybrid approach:
db.products.createIndex({ "attributes.brand": 1 })         // Fast brand queries
db.products.createIndex({ "attributes.category": 1 })      // Fast category queries
db.products.createIndex({ "customAttributes.$**": 1 })     // User-defined attrs
```

**Common wildcard use cases:**

```javascript
// 1. E-commerce product attributes
db.products.createIndex({ "specs.$**": 1 })
// Query any spec: { "specs.cpuCores": 8 }, { "specs.batteryLife": "10hr" }

// 2. IoT sensor data
db.sensorReadings.createIndex({ "readings.$**": 1 })
// Different sensors have different fields

// 3. User preferences/settings
db.users.createIndex({ "preferences.$**": 1 })
// Users have varying preference structures

// 4. Event properties
db.events.createIndex({ "properties.$**": 1 })
// Analytics events with arbitrary properties

// 5. API request/response logging
db.apiLogs.createIndex({ "requestBody.$**": 1 })
// Search within logged request bodies

// 6. CMS/content management
db.content.createIndex({ "metadata.$**": 1 })
// Variable metadata per content type
```

**When NOT to use wildcard indexes:**

- **Known, stable schema**: Explicit indexes are faster and smaller.
- **Sorting required**: Wildcard indexes don't support sort operations.
- **Covered queries needed**: Wildcard indexes always require document fetch.
- **High-cardinality paths**: If most paths have unique values, index becomes huge.
- **Array elements**: Wildcard indexes can index arrays, but behavior is complex.

**Verify with:**

```javascript
// Analyze wildcard index usage
function analyzeWildcardIndex(collection) {
  const indexes = db[collection].getIndexes()
  const wildcardIndexes = indexes.filter(i =>
    Object.keys(i.key).some(k => k.includes("$**"))
  )

  if (wildcardIndexes.length === 0) {
    print(`No wildcard indexes on ${collection}`)
    return
  }

  print(`Wildcard indexes on ${collection}:`)
  wildcardIndexes.forEach(idx => {
    print(`\n  Name: ${idx.name}`)
    print(`  Pattern: ${JSON.stringify(idx.key)}`)
    if (idx.wildcardProjection) {
      print(`  Projection: ${JSON.stringify(idx.wildcardProjection)}`)
    }
  })

  // Get index stats
  const stats = db[collection].aggregate([
    { $indexStats: {} }
  ]).toArray()

  const wildcardStats = stats.filter(s =>
    wildcardIndexes.some(i => i.name === s.name)
  )

  wildcardStats.forEach(s => {
    print(`\n  Usage (${s.name}):`)
    print(`    Operations: ${s.accesses.ops}`)
    print(`    Since: ${s.accesses.since}`)
  })

  // Show indexed paths (sample)
  print(`\nSample indexed paths:`)
  const sample = db[collection].findOne()
  if (sample) {
    const wildcardPath = Object.keys(wildcardIndexes[0].key)[0].replace(".$**", "")
    const targetObj = wildcardPath ? sample[wildcardPath.split(".")[0]] : sample

    function printPaths(obj, prefix = wildcardPath || "") {
      for (const [key, value] of Object.entries(obj || {})) {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          printPaths(value, path)
        } else {
          print(`    ${path}`)
        }
      }
    }
    printPaths(targetObj)
  }
}

// Usage
analyzeWildcardIndex("products")
```

---

## ⚠️ Before You Implement

**I recommend a wildcard index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Truly dynamic fields | Wildcard is for unknown fields; explicit indexes better for known fields | Review schema patterns |
| No existing wildcard | Only one wildcard index per path | `db.collection.getIndexes()` |
| No sort needed | Wildcard indexes can't support sort on dynamic paths | Review query requirements |

**Check for existing wildcard indexes:**
```javascript
db.collection.getIndexes().filter(i =>
  Object.keys(i.key).some(k => k.includes("$**"))
)
```

**Interpretation:**
- ✅ Dynamic fields + no existing wildcard: Good candidate
- ⚠️ Known high-frequency fields: Add explicit indexes for those
- 🔴 Sort required on dynamic paths: Wildcard won't help

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing wildcard indexes
- `mcp__mongodb__collection-schema` - Analyze field patterns

**Just ask:** "Verify if a wildcard index makes sense for [collection]"

---

Reference: [Wildcard Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-wildcard/)
