---
title: Use Schema Validation
impact: MEDIUM
impactDescription: Prevents invalid data at database level
tags: schema, validation, json-schema, data-integrity, fundamentals
---

## Use Schema Validation

Enforce document structure with MongoDB's built-in JSON Schema validation. Catch invalid data before it corrupts your database, not after.

**Incorrect (no validation):**

```javascript
// Any document can be inserted
db.users.insertOne({ email: "not-an-email", age: "twenty" })
// Invalid data now in production
```

**Correct (schema validation):**

```javascript
// Create collection with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        },
        status: {
          enum: ["active", "inactive", "pending"]
        },
        addresses: {
          bsonType: "array",
          maxItems: 10,
          items: {
            bsonType: "object",
            required: ["city"],
            properties: {
              street: { bsonType: "string" },
              city: { bsonType: "string" },
              zip: { bsonType: "string" }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Invalid inserts now fail
db.users.insertOne({ email: "not-an-email" })
// Error: Document failed validation
```

**Validation levels:**

- `strict`: Validate all inserts and updates (default)
- `moderate`: Only validate documents that already match schema

**Validation actions:**

- `error`: Reject invalid documents (default)
- `warn`: Allow but log warning

**Add validation to existing collection:**

```javascript
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: {...} },
  validationLevel: "moderate" // Don't break existing invalid docs
})
```

Reference: [Schema Validation](https://mongodb.com/docs/manual/core/schema-validation/)
