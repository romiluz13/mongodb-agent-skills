---
title: Use Schema Validation
impact: MEDIUM
impactDescription: "Prevents invalid data at database level, catches bugs before production corruption"
tags: schema, validation, json-schema, data-integrity, fundamentals
---

## Use Schema Validation

**Enforce document structure with MongoDB's built-in JSON Schema validation.** Catch invalid data before it corrupts your database, not after you've shipped 10,000 malformed documents to production. Schema validation is your last line of defense when application bugs slip through.

**Incorrect (no validation):**

```javascript
// Any document can be inserted - no safety net
db.users.insertOne({ email: "not-an-email", age: "twenty" })
// Now you have: { email: "not-an-email", age: "twenty" }
// Application crashes when parsing age as number
// Or worse: silent data corruption, discovered months later

db.users.insertOne({ name: "Bob" })  // Missing required email
// Downstream systems expect email, fail silently
```

**Correct (schema validation):**

```javascript
// Create collection with validation rules
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email address"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "must be 1-100 characters"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150,
          description: "must be integer 0-150"
        },
        status: {
          enum: ["active", "inactive", "pending"],
          description: "must be one of: active, inactive, pending"
        },
        addresses: {
          bsonType: "array",
          maxItems: 10,  // Prevent unbounded arrays
          items: {
            bsonType: "object",
            required: ["city"],
            properties: {
              street: { bsonType: "string" },
              city: { bsonType: "string" },
              zip: { bsonType: "string", pattern: "^[0-9]{5}$" }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Invalid inserts now fail immediately with clear error
db.users.insertOne({ email: "not-an-email" })
// Error: Document failed validation:
// "email" does not match pattern, "name" is required
```

**Validation levels and actions:**

| validationLevel | Behavior |
|-----------------|----------|
| `strict` | Validate ALL inserts and updates (default, recommended) |
| `moderate` | Only validate documents that already match schema |

| validationAction | Behavior |
|------------------|----------|
| `error` | Reject invalid documents (default, recommended) |
| `warn` | Allow but log warning (use during migration only) |

**Add validation to existing collection:**

```javascript
// Start with moderate + warn to discover violations
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: {...} },
  validationLevel: "moderate",  // Don't break existing invalid docs
  validationAction: "warn"       // Log violations, don't block
})

// Check logs for violations, fix existing data
db.users.find({ $nor: [{ email: { $regex: /^[a-zA-Z0-9._%+-]+@/ } }] })

// Then switch to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**When NOT to use this pattern:**

- **Rapid prototyping**: Skip validation during early development, add before production.
- **Schema-per-document designs**: Some collections intentionally store varied document shapes.
- **Log/event collections**: High-write collections where validation overhead matters.

**Verify with:**

```javascript
// Check if validation exists on collection
db.getCollectionInfos({ name: "users" })[0].options.validator
// Empty = no validation (add it!)

// Test your validation rules
db.runCommand({
  validate: "users",
  full: true
})

// Find documents that would fail current validation
db.users.find({
  $nor: [
    { email: { $type: "string" } },
    { name: { $type: "string" } }
  ]
})
```

---

## Before You Implement

**I recommend adding schema validation, but please verify your current validation state first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Check existing validation rules | May already have partial validation | Get collection info |
| Find invalid documents | Must fix before enabling strict validation | Query for type mismatches |
| Identify required fields | Fields that cause crashes when missing | Review application errors |
| Sample document structures | Understand current schema before enforcing | Analyze schema from samples |

**Verification query:**
```javascript
// Check if validation already exists
db.getCollectionInfos({ name: "yourCollection" })[0].options.validator
// undefined = no validation

// Find documents with type mismatches (example for email field)
db.collection.find({
  $or: [
    { email: { $exists: true, $not: { $type: "string" } } },
    { email: { $exists: false } }  // Missing required field
  ]
}).limit(10)

// Get current schema structure from samples
db.collection.aggregate([
  { $sample: { size: 100 } },
  { $project: { fields: { $objectToArray: "$$ROOT" } } },
  { $unwind: "$fields" },
  { $group: {
    _id: "$fields.k",
    types: { $addToSet: { $type: "$fields.v" } },
    count: { $sum: 1 }
  }}
])
```

**Interpretation:**
- Good result (validation exists, no invalid docs): Schema is well-controlled
- Warning (no validation but consistent data): Add validation to prevent future issues
- Bad result (no validation, inconsistent types): Fix data before adding strict validation

---

## MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-schema` - Infer current schema from document samples
- `mcp__mongodb__find` - Find documents that would fail validation
- `mcp__mongodb__aggregate` - Analyze field type consistency

**Just ask:** "Can you analyze my collection and generate appropriate schema validation rules?"

---

Reference: [Schema Validation](https://mongodb.com/docs/manual/core/schema-validation/)
