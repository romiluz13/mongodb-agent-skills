---
title: Use Sparse Indexes for Optional Fields
impact: HIGH
impactDescription: "Optional field in 10% of docs: sparse index is 10× smaller, unique constraints work correctly"
tags: index, sparse, optional, null, exists, optimization
---

## Use Sparse Indexes for Optional Fields

**Sparse indexes skip documents where the indexed field doesn't exist—essential for optional fields.** If only 100K of 1M documents have a `twitterHandle` field, a sparse index contains 100K entries (not 1M). This saves space and makes unique constraints work correctly for optional fields (without sparse, `null` would conflict with itself).

**Incorrect (regular index on optional field):**

```javascript
// Users collection: 1M documents
// - 100K have twitterHandle (10%)
// - 900K don't have twitterHandle (90%)

// Regular index includes ALL documents
db.users.createIndex({ twitterHandle: 1 })

// Index contains:
// - 100K entries with actual values
// - 900K entries with null (field doesn't exist → indexed as null)

// Problems:
// 1. Index size: 1M entries (10× larger than needed)
// 2. Query inefficiency:
db.users.find({ twitterHandle: "@alice" })
// Must skip through 900K null entries

// 3. Unique constraint FAILS:
db.users.createIndex({ twitterHandle: 1 }, { unique: true })
// ERROR: Duplicate key error on null
// All 900K docs without twitterHandle have null, violating unique
```

**Correct (sparse index on optional field):**

```javascript
// Sparse index skips documents where field doesn't exist
db.users.createIndex({ twitterHandle: 1 }, { sparse: true })

// Index contains:
// - 100K entries (only documents WITH twitterHandle)
// - 0 null entries

// Benefits:
// 1. Index size: 100K entries (90% reduction)
// 2. Query efficiency: No null entries to skip

// 3. Unique constraint WORKS:
db.users.createIndex({ twitterHandle: 1 }, { unique: true, sparse: true })
// ✓ Works! Multiple docs without twitterHandle are allowed
// Only docs WITH twitterHandle must be unique
```

**How sparse indexes handle missing vs null:**

```javascript
// Document states:
{ _id: 1, name: "Alice", twitterHandle: "@alice" }  // Has field
{ _id: 2, name: "Bob", twitterHandle: null }        // Explicitly null
{ _id: 3, name: "Charlie" }                         // Field missing

// Sparse index { twitterHandle: 1 } contains:
// - Doc 1: "@alice" ✓ Indexed
// - Doc 2: null ✓ Indexed (field EXISTS, value is null)
// - Doc 3: (not indexed) ✓ Skipped (field DOESN'T EXIST)

// Key distinction:
// - Sparse skips: Field doesn't exist
// - Sparse includes: Field exists with any value (including null)

// If you want to exclude null values too, use partial index:
db.users.createIndex(
  { twitterHandle: 1 },
  { partialFilterExpression: { twitterHandle: { $type: "string" } } }
)
// Only indexes string values, excludes missing AND null
```

**Sparse index query behavior:**

```javascript
// Sparse index: { optionalField: 1 }

// Queries that CAN use sparse index:
db.collection.find({ optionalField: "value" })  // ✓
db.collection.find({ optionalField: { $gt: 10 } })  // ✓
db.collection.find({ optionalField: { $exists: true } })  // ✓

// Queries that CANNOT use sparse index for full results:
db.collection.find({ optionalField: null })
// Returns docs with optionalField: null AND docs without optionalField
// Sparse index only has docs WITH the field → would miss results!

db.collection.find({ optionalField: { $exists: false } })
// Looking for docs WITHOUT the field
// Sparse index doesn't contain these → COLLSCAN needed

db.collection.find().sort({ optionalField: 1 })
// Sort needs all documents
// Sparse index missing 900K docs → can't use for complete sort
// MongoDB may still use it with SORT_MERGE if beneficial
```

**Sparse + unique for optional unique fields:**

```javascript
// Use case: Optional but unique email field
// - Some users sign up with email
// - Some users sign up with phone only (no email)
// - Emails must be unique when present

// WRONG: Unique without sparse
db.users.createIndex({ email: 1 }, { unique: true })
// Fails: Multiple docs without email all have null → duplicate

// CORRECT: Unique with sparse
db.users.createIndex({ email: 1 }, { unique: true, sparse: true })
// ✓ Docs without email: allowed (not in index)
// ✓ Docs with email: must be unique

// Insert behavior:
db.users.insertOne({ name: "Alice" })  // ✓ No email, not indexed
db.users.insertOne({ name: "Bob" })    // ✓ No email, not indexed
db.users.insertOne({ name: "Charlie", email: "c@x.com" })  // ✓ Unique email
db.users.insertOne({ name: "Dave", email: "c@x.com" })     // ✗ Duplicate email!
```

**Compound sparse indexes:**

```javascript
// Sparse on compound index: Skips docs missing ANY indexed field
db.events.createIndex(
  { userId: 1, sessionId: 1 },
  { sparse: true }
)

// Document inclusion:
{ userId: "u1", sessionId: "s1" }  // ✓ Indexed (both fields)
{ userId: "u1" }                   // ✗ Not indexed (missing sessionId)
{ sessionId: "s1" }                // ✗ Not indexed (missing userId)
{ }                                // ✗ Not indexed (missing both)

// This can be surprising!
// If you want "either field exists", use partial index instead:
db.events.createIndex(
  { userId: 1, sessionId: 1 },
  { partialFilterExpression: {
      $or: [
        { userId: { $exists: true } },
        { sessionId: { $exists: true } }
      ]
  }}
)
```

**Sparse vs Partial: When to use which:**

```javascript
// SPARSE: Simple "field exists" case
// Use when: You only care if the field exists or not
db.users.createIndex({ twitterHandle: 1 }, { sparse: true })

// PARTIAL: Complex filter conditions
// Use when: You need more than just existence check
db.users.createIndex(
  { twitterHandle: 1 },
  { partialFilterExpression: {
      twitterHandle: { $exists: true },
      isVerified: true  // Additional condition
  }}
)

// PARTIAL: Exclude null values
// Sparse includes null, partial can exclude it
db.users.createIndex(
  { optionalScore: 1 },
  { partialFilterExpression: {
      optionalScore: { $type: "number" }  // Excludes missing AND null
  }}
)

// Recommendation: Prefer partial indexes for new code
// They're more explicit and flexible than sparse
```

**When NOT to use sparse indexes:**

- **Sort operations on full collection**: Sparse index can't sort docs without the field.
- **Queries for missing/null values**: `{ field: null }` or `{ field: { $exists: false } }` can't use sparse.
- **Coverage queries**: If you need the field value for all docs, sparse won't help.
- **Field usually exists**: If 90% of docs have the field, sparse saves little.

**Verify with:**

```javascript
// Check sparse index behavior
function analyzeSparseIndex(collection, field) {
  const total = db[collection].countDocuments()
  const withField = db[collection].countDocuments({ [field]: { $exists: true } })
  const withNull = db[collection].countDocuments({ [field]: null })
  const withoutField = total - withField

  // Note: withNull includes both explicit null AND missing field
  const explicitNull = withNull - withoutField

  print(`Field: ${field}`)
  print(`Total documents: ${total.toLocaleString()}`)
  print(`With field (any value): ${withField.toLocaleString()} (${(withField/total*100).toFixed(1)}%)`)
  print(`  - With explicit null: ${explicitNull.toLocaleString()}`)
  print(`Without field: ${withoutField.toLocaleString()} (${(withoutField/total*100).toFixed(1)}%)`)

  print(`\nSparse index would contain: ${withField.toLocaleString()} entries`)
  print(`Regular index would contain: ${total.toLocaleString()} entries`)
  print(`Savings: ${((total-withField)/total*100).toFixed(1)}%`)

  if (withoutField > total * 0.3) {
    print(`\n✓ Sparse index recommended (>30% docs without field)`)
  }

  // Check existing indexes
  const indexes = db[collection].getIndexes()
  const fieldIndex = indexes.find(i => Object.keys(i.key)[0] === field)
  if (fieldIndex) {
    print(`\nExisting index: ${fieldIndex.name}`)
    print(`  Sparse: ${fieldIndex.sparse ? "YES" : "NO"}`)
    print(`  Unique: ${fieldIndex.unique ? "YES" : "NO"}`)
  }
}

// Usage
analyzeSparseIndex("users", "twitterHandle")
```

Reference: [Sparse Indexes](https://mongodb.com/docs/manual/core/index-sparse/)
