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

---

## ⚠️ Before You Implement

**I recommend a staged validation rollout, but please verify your starting point first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| Current validation state | Know if validation exists already | Get collection info |
| Non-compliant document count | Plan cleanup before strict mode | Query against validator |
| Application write paths | Identify code that might break | Review insert/update operations |
| Rollback plan | What if strict mode causes issues | Document current settings |

**Verification query:**
```javascript
// Document current state (for rollback)
const info = db.getCollectionInfos({ name: "collectionName" })[0]
print("=== Current State (save for rollback) ===")
print("Level:", info.options.validationLevel || "none")
print("Action:", info.options.validationAction || "error")
print("Validator:", JSON.stringify(info.options.validator, null, 2))

// Check how many documents would fail proposed validation
const proposedValidator = {
  $jsonSchema: {
    required: ["email"],  // Replace with your rules
    properties: { email: { bsonType: "string" } }
  }
}

db.collection.countDocuments({ $nor: [proposedValidator] })

// Sample failing documents to plan cleanup
db.collection.find({ $nor: [proposedValidator] }).limit(10)
```

**Interpretation:**
- ✅ Zero failing docs: Can go directly to strict + error
- ⚠️ <5% failing docs: Use warn phase, fix quickly, then strict
- 🔴 >5% failing docs: Extended warn phase with systematic cleanup plan

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__list-collections` - Get current validation configuration
- `mcp__mongodb__count` - Count documents failing proposed validation
- `mcp__mongodb__find` - Sample non-compliant documents
- `mcp__mongodb__mongodb-logs` - Check for existing validation warnings

**Just ask:** "Can you help me plan a safe validation rollout for my collection?"

---

Reference: [Handle Invalid Documents](https://mongodb.com/docs/manual/core/schema-validation/handle-invalid-documents/)
