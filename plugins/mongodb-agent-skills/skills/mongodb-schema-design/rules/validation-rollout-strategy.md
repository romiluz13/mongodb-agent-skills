---
title: Roll Out Schema Validation Safely (Warn to Error)
impact: MEDIUM
impactDescription: "Prevents production write failures when introducing new validation rules"
tags: schema, validation, rollout, migration, validationAction, validationLevel
---

## Roll Out Schema Validation Safely (Warn to Error)

**Introduce validation in phases on existing collections.** Start with `validationAction: "warn"` so you can identify invalid documents without breaking writes, then backfill and switch to `"error"` when clean.

**Incorrect (enable strict validation immediately):**

```javascript
// Existing collection has legacy documents
// Enabling strict validation can reject writes unexpectedly

db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: { bsonType: "object", required: ["email"] } },
  validationAction: "error",
  validationLevel: "strict"
})
```

**Correct (staged rollout):**

```javascript
// Phase 1: warn-only while you audit and fix data

db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: { bsonType: "object", required: ["email"] } },
  validationAction: "warn",
  validationLevel: "moderate"
})

// Phase 2: after backfill, enforce strictly

db.runCommand({
  collMod: "users",
  validationAction: "error",
  validationLevel: "strict"
})
```

**When NOT to use this pattern:**

- **Brand new collections**: Use `validationAction: "error"` immediately.
- **Offline maintenance windows**: You can fix data first and enable strict mode directly.

**Verify with:**

```javascript
// Inspect current validation settings

db.getCollectionInfos({ name: "users" })
```

Reference: [Handle Invalid Documents](https://mongodb.com/docs/manual/core/schema-validation/handle-invalid-documents/)
