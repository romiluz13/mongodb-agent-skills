---
title: Use Polymorphic Pattern for Heterogeneous Documents
impact: MEDIUM
impactDescription: "Keeps related entities in one collection while preserving type-specific fields"
tags: schema, patterns, polymorphic, discriminator, flexible-schema, indexing
---

## Use Polymorphic Pattern for Heterogeneous Documents

**Store related but different document shapes in one collection with a type discriminator.** This keeps shared queries and indexes simple while allowing type-specific fields.

**Incorrect (separate collections per subtype):**

```javascript
// products_books, products_electronics, products_furniture
// Queries across all products require multiple queries or unions
```

**Correct (single collection with a type field):**

```javascript
// One collection with a discriminator
{
  _id: 1,
  type: "book",
  title: "Database Systems",
  author: "Elmasri",
  pages: 1200
}

{
  _id: 2,
  type: "electronics",
  name: "Noise Cancelling Headphones",
  wattage: 20,
  batteryHours: 30
}

// Query by type

db.products.createIndex({ type: 1 })

db.products.find({ type: "book" })
```

**When NOT to use this pattern:**

- **Conflicting index needs**: If each type needs very different indexes.
- **Highly divergent access patterns**: Separate collections may be simpler.
- **Strict schema enforcement per type**: Use separate collections if required.

**Verify with:**

```javascript
// Ensure the type index is used

db.products.find({ type: "electronics" }).explain("executionStats")
```

Reference: [Polymorphic Schema Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/polymorphic-data/polymorphic-schema-pattern/)
