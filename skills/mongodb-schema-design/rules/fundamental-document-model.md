---
title: Embrace the Document Model
impact: HIGH
impactDescription: Reduces schema complexity and query count
tags: schema, document-model, fundamentals, sql-migration
---

## Embrace the Document Model

Don't recreate SQL tables in MongoDB. The document model exists to avoid joins, not to store flat rows with foreign keys. Think in documents, not tables.

**Incorrect (SQL patterns in MongoDB):**

```javascript
// SQL-style: flat documents with IDs everywhere
// customers: { _id, name, email }
// addresses: { _id, customerId, type, street, city, zip }
// phones: { _id, customerId, type, number }
// preferences: { _id, customerId, key, value }

// To load a customer profile: 4 queries + application joins
```

**Correct (rich document model):**

```javascript
// Customer document contains everything about the customer
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

// Single query loads complete customer
db.customers.findOne({ _id: "cust123" })
```

**Benefits of document model:**

- **Atomicity**: Update entire customer in one operation
- **Performance**: No joins, single disk read
- **Simplicity**: Application code mirrors data structure
- **Flexibility**: Schema can vary per document

**When migrating from SQL:**

1. Don't convert tables 1:1 to collections
2. Identify which tables are always joined
3. Denormalize those joins into documents
4. Keep separate only what's accessed separately

Reference: [Schema Design Process](https://mongodb.com/docs/manual/data-modeling/schema-design-process/)
