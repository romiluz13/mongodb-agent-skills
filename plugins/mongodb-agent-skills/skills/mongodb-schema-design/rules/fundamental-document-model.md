---
title: Embrace the Document Model
impact: HIGH
impactDescription: "4× fewer queries, single atomic operation vs multi-table transaction"
tags: schema, document-model, fundamentals, sql-migration
---

## Embrace the Document Model

**Don't recreate SQL tables in MongoDB.** The document model exists to eliminate joins, not to store flat rows with foreign keys scattered across collections. Teams migrating from SQL who replicate their table structure see 4× more queries and lose MongoDB's single-document atomicity.

**Incorrect (SQL patterns in MongoDB):**

```javascript
// SQL-style: 4 collections for one entity
// customers: { _id, name, email }
// addresses: { _id, customerId, type, street, city, zip }
// phones: { _id, customerId, type, number }
// preferences: { _id, customerId, key, value }

// To load customer profile: 4 queries required
const customer = db.customers.findOne({ _id: "cust123" })  // Query 1
const addresses = db.addresses.find({ customerId: "cust123" })  // Query 2
const phones = db.phones.find({ customerId: "cust123" })  // Query 3
const prefs = db.preferences.find({ customerId: "cust123" })  // Query 4
// Total: 4 round-trips, 4 index lookups, application-side joining
// Update requires transaction or risks inconsistency
```

**Correct (rich document model):**

```javascript
// Customer document contains everything about the customer
// All data retrieved in single read, updated atomically
{
  _id: "cust123",
  name: "Alice Smith",
  email: "alice@example.com",
  addresses: [
    { type: "home", street: "123 Main", city: "Boston", zip: "02101" },
    { type: "work", street: "456 Oak", city: "Boston", zip: "02102" }
  ],
  phones: [
    { type: "mobile", number: "555-1234" },
    { type: "work", number: "555-5678" }
  ],
  preferences: {
    newsletter: true,
    theme: "dark",
    language: "en"
  },
  createdAt: ISODate("2024-01-01")
}

// Single query loads complete customer - 1 round-trip
db.customers.findOne({ _id: "cust123" })

// Atomic update - no transaction needed
db.customers.updateOne(
  { _id: "cust123" },
  { $push: { addresses: newAddress }, $set: { "preferences.theme": "light" } }
)
```

**Benefits of document model:**

| Aspect | SQL Approach | Document Approach |
|--------|-------------|-------------------|
| Queries per entity | 4+ | 1 |
| Atomicity | Requires transaction | Built-in |
| Schema changes | ALTER TABLE + migration | Just write new fields |
| Network round-trips | N per entity | 1 per entity |

**When migrating from SQL:**

1. Don't convert tables 1:1 to collections
2. Identify which tables are always joined together
3. Denormalize those joins into single documents
4. Keep separate only what's accessed separately

**When NOT to use this pattern:**

- **Genuinely independent data**: If addresses are shared across users or accessed independently, keep them separate.
- **Unbounded relationships**: User with 10,000 orders should NOT embed all orders.
- **Regulatory requirements**: Some compliance rules require normalized audit trails.

## Verify with

```javascript
// Count your collections vs expected entities
db.adminCommand({ listDatabases: 1 }).databases.forEach(d => {
  const colls = db.getSiblingDB(d.name).getCollectionNames().length
  print(`${d.name}: ${colls} collections`)
})
// Red flag: Collection count >> entity count (SQL thinking)

// Check for SQL-style foreign key patterns
db.addresses.aggregate([
  { $group: { _id: "$customerId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 0 } } }
]).itcount()
// If addresses always belong to customers, they should be embedded
```

Reference: [Schema Design Process](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)
