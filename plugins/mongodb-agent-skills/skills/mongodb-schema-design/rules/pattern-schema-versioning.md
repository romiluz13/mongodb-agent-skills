---
title: Use Schema Versioning for Safe Evolution
impact: MEDIUM
impactDescription: "Avoids breaking reads/writes during migrations and enables online backfills"
tags: schema, patterns, versioning, migration, evolution, backward-compatibility
---

## Use Schema Versioning for Safe Evolution

**Schema changes are inevitable.** Add a `schemaVersion` field so your application can read old documents while you migrate data in-place. This prevents production outages caused by suddenly missing or renamed fields.

**Incorrect (breaking change without versioning):**

```javascript
// Old documents only have "address" as a string
{ _id: 1, name: "Ada", address: "12 Main St" }

// New code expects "address" to be an object
// Old documents now break reads or writes
```

**Correct (versioned documents with backfill path):**

```javascript
// New documents include version and new structure
{ _id: 1, name: "Ada", schemaVersion: 2,
  address: { street: "12 Main St", city: "NYC" } }

// Application reads both versions
// if schemaVersion < 2, treat address as legacy string

// Online backfill for old docs
// Upgrade only when safe for the workload

db.users.updateMany(
  { schemaVersion: { $ne: 2 } },
  [
    { $set: {
        address: { street: "$address" },
        schemaVersion: 2
      } }
  ]
)
```

**When NOT to use this pattern:**

- **Small datasets with downtime**: You can migrate offline in minutes.
- **Truly stable schemas**: If no evolution is expected.

**Verify with:**

```javascript
// Track version distribution

db.users.aggregate([
  { $group: { _id: "$schemaVersion", count: { $sum: 1 } } }
])
// Remaining old versions indicate incomplete migration
```

Reference: [Schema Versioning Pattern](https://mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/schema-versioning/)
