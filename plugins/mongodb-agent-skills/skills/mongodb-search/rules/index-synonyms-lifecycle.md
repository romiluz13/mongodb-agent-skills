---
title: Manage Synonyms as a Controlled Data Source
impact: HIGH
impactDescription: Avoids invalid synonym mappings and surprise relevance shifts
tags: synonyms, relevance, lifecycle, mapping
---

## Manage Synonyms as a Controlled Data Source

**Impact: HIGH (bad synonym data can break index builds and degrade relevance)**

Keep synonym source collections valid and minimal. Atlas Search watches synonym source changes and updates internal synonym maps without reindex, but updates are eventually reflected.

**Incorrect (invalid synonym docs in production source):**

```javascript
// WRONG: malformed document, missing mappingType and synonyms array
db.sample_synonyms.insertOne({ input: "pc" })
```

**Correct (valid synonym documents):**

```javascript
db.sample_synonyms.insertMany([
  { mappingType: "equivalent", synonyms: ["car", "vehicle", "automobile"] },
  { mappingType: "explicit", input: ["pc"], synonyms: ["computer", "workstation"] }
])
```

**How to verify:**

- Validate synonym source schema before writing to production.
- Confirm expected relevance changes after propagation delay.

**When NOT to use this pattern:**

- You do not need synonym expansion for the use case.

Reference: [Synonyms](https://www.mongodb.com/docs/atlas/atlas-search/synonyms.md)
