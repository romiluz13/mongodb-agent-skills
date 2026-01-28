---
title: Choose Validation Level and Action Appropriately
impact: MEDIUM
impactDescription: "Enables safe schema migrations, prevents production outages during validation rollout"
tags: schema, validation, migration, validation-level, validation-action
---

## Choose Validation Level and Action Appropriately

**MongoDB's validation levels and actions let you roll out schema validation safely.** Using the wrong settings can either block legitimate operations or silently allow invalid data. Choose based on your migration state and data quality requirements.

**Incorrect (strict validation on existing data):**

```javascript
// Adding strict validation to collection with legacy data
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      required: ["email", "name"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" }
      }
    }
  },
  validationLevel: "strict",   // Validates ALL documents
  validationAction: "error"    // Rejects invalid
})
// Problem: 10,000 existing users without email field
// Result: All updates to those users fail!
// "Document failed validation" on every updateOne()
```

**Correct (gradual rollout with moderate level):**

```javascript
// Step 1: Start with warn + moderate to discover issues
db.runCommand({
  collMod: "users",
  validator: { $jsonSchema: { required: ["email", "name"] } },
  validationLevel: "moderate",  // Skip existing non-matching docs
  validationAction: "warn"      // Log but allow
})

// Step 2: Find and fix non-compliant documents
db.users.find({ email: { $exists: false } })
// Fix: Add missing emails

// Step 3: Only then switch to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**Validation Levels:**

| Level | Behavior | Use When |
|-------|----------|----------|
| `strict` | Validate ALL inserts and updates | New collections, stable schemas |
| `moderate` | Only validate documents that already match | Adding validation to existing collections |

**Validation Actions:**

| Action | Behavior | Use When |
|--------|----------|----------|
| `error` | Reject invalid documents | Production, data integrity critical |
| `warn` | Allow but log warning | Discovery phase, monitoring |
| `errorAndLog` (v8.1+) | Reject AND log | Production with audit trail |

**Migration workflow—adding validation to existing collection:**

```javascript
// Step 1: Start with warn to discover violations
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      required: ["email", "name"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" },
        name: { bsonType: "string", minLength: 1 }
      }
    }
  },
  validationLevel: "moderate",  // Don't fail existing invalid docs
  validationAction: "warn"      // Log but allow
})

// Step 2: Check logs for validation warnings
db.adminCommand({ getLog: "global" }).log.filter(
  l => l.includes("Document validation")
)

// Step 3: Query to find non-compliant documents
db.users.find({
  $or: [
    { email: { $not: { $type: "string" } } },
    { email: { $not: { $regex: /@/ } } },
    { name: { $exists: false } }
  ]
})

// Step 4: Fix non-compliant data
db.users.updateMany(
  { email: { $not: { $regex: /@/ } } },
  { $set: { email: "invalid@fixme.com", needsReview: true } }
)

// Step 5: Tighten to strict + error
db.runCommand({
  collMod: "users",
  validationLevel: "strict",
  validationAction: "error"
})
```

**Understanding `moderate` level:**

```javascript
// With validationLevel: "moderate"

// Document that DOESN'T match validation rules
{ _id: 1, email: "not-an-email", name: 123 }  // Pre-existing invalid doc

// Updates to non-matching documents SKIP validation
db.users.updateOne(
  { _id: 1 },
  { $set: { status: "active" } }
)
// SUCCESS - validation skipped because doc didn't match rules

// New inserts still validate
db.users.insertOne({ email: "invalid" })
// FAILS - new documents always validated

// If you update a matching document to become invalid
db.users.updateOne(
  { _id: 2 },  // Assume this doc currently matches rules
  { $set: { email: 123 } }  // Makes it invalid
)
// FAILS - matching documents are validated on update
```

**Error logging (MongoDB 8.1+):**

```javascript
// Use errorAndLog for audit trails
db.runCommand({
  collMod: "users",
  validationAction: "errorAndLog"
})

// Failed validations are rejected AND logged
db.users.insertOne({ email: "bad" })
// Logs: { ... "attr": { "error": "Document failed validation" } ... }

// Query mongod logs for validation failures
db.adminCommand({ getLog: "global" }).log.filter(
  l => l.includes("validation") && l.includes("error")
)
```

**Bypassing validation (use sparingly):**

```javascript
// Admin operations that need to bypass validation
db.users.insertOne(
  { _id: "system", internalFlag: true },  // Might not match user schema
  { bypassDocumentValidation: true }
)

// Bulk migration with bypass
db.users.bulkWrite(
  [{ insertOne: { document: { legacy: true } } }],
  { bypassDocumentValidation: true }
)

// WARNING: Requires appropriate privileges
// Only use for migrations or system documents
```

**Combining with schema versioning:**

```javascript
// Allow multiple schema versions during migration
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        schemaVersion: { enum: [1, 2] }  // Accept both versions
      },
      oneOf: [
        // Version 1 schema
        {
          properties: { schemaVersion: { const: 1 }, name: { bsonType: "string" } },
          required: ["name"]
        },
        // Version 2 schema
        {
          properties: {
            schemaVersion: { const: 2 },
            firstName: { bsonType: "string" },
            lastName: { bsonType: "string" }
          },
          required: ["firstName", "lastName"]
        }
      ]
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

// Both versions are valid
db.users.insertOne({ schemaVersion: 1, name: "Alice" })  // OK
db.users.insertOne({ schemaVersion: 2, firstName: "Bob", lastName: "Smith" })  // OK
```

**When NOT to use strict + error:**

- **During active migration**: Use moderate + warn until data is cleaned.
- **Legacy systems integration**: External data may not conform.
- **Feature flag rollouts**: New fields may be optional initially.

**Verify with:**

```javascript
// Check current validation settings
const info = db.getCollectionInfos({ name: "users" })[0]
console.log("Level:", info.options.validationLevel)
console.log("Action:", info.options.validationAction)
console.log("Validator:", JSON.stringify(info.options.validator, null, 2))

// Count documents that would fail current validation
// (Run this BEFORE switching to strict)
const validator = info.options.validator
db.users.countDocuments({
  $nor: [validator]  // Documents NOT matching validator
})
// If count > 0, fix data before switching to strict
```

---

## ⚠️ Before You Implement

**I recommend adjusting validation settings, but please verify your current state first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current validation settings | Know what you're changing from | Get collection info |
| Non-compliant document count | Strict validation will reject updates to these | Query with $nor validator |
| Write patterns | Identify which operations might fail | Review application write paths |
| Migration timeline | Plan warn→error transition | Estimate cleanup time |

**Verification query:**
```javascript
// Check current validation settings
const info = db.getCollectionInfos({ name: "collectionName" })[0]
print("Current level:", info.options.validationLevel || "off")
print("Current action:", info.options.validationAction || "error")
print("Validator:", JSON.stringify(info.options.validator, null, 2))

// Count documents that would fail validation
// (Replace with your actual validator)
db.collection.countDocuments({
  $nor: [info.options.validator || {}]
})

// Sample non-compliant documents to understand fixes needed
db.collection.find({
  $nor: [info.options.validator || {}]
}).limit(5)
```

**Interpretation:**
- ✅ Zero non-compliant docs: Safe to use strict + error
- ⚠️ Some non-compliant docs: Use moderate + warn first, then clean up
- 🔴 Many non-compliant docs: Plan migration before changing validation

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__list-collections` - Get current validation settings
- `mcp__mongodb__aggregate` - Count non-compliant documents
- `mcp__mongodb__find` - Sample non-compliant documents
- `mcp__mongodb__mongodb-logs` - Check for recent validation warnings

**Just ask:** "Can you check my collection's validation status before I change settings?"

---

Reference: [Specify Validation Level](https://mongodb.com/docs/manual/core/schema-validation/specify-validation-level/)
