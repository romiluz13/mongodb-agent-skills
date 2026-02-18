---
title: Prefer Prefix Regex Patterns for Better Index Use
impact: HIGH
impactDescription: "Case-sensitive prefix regex patterns can use indexes efficiently; broad regex patterns often degrade scan efficiency"
tags: query, regex, text-search, index-usage, performance, autocomplete
---

## Prefer Prefix Regex Patterns for Better Index Use

**Regex index behavior depends on pattern shape.** For case-sensitive regex queries, MongoDB can use an index if one exists. Prefix expressions (for example `^abc`) are optimized best because the engine can bound the index range.

**Incorrect (assuming any regex is equally index-friendly):**

```javascript
db.users.createIndex({ email: 1 })

// Non-prefix pattern can require scanning many index entries or documents.
db.users.find({ email: /gmail/ })
```

**Correct (prefix pattern for bounded index scan):**

```javascript
db.users.createIndex({ email: 1 })

// Prefix expression: optimized range scan
db.users.find({ email: /^alice/ })

// Compare with explain("executionStats") to confirm scan volume.
```

**Pattern guidance:**

| Pattern | Typical Index Behavior |
|---------|-------------------------|
| `/^prefix/` | Best regex index performance |
| `/^prefix.*/` | Uses index, usually less efficient than `/^prefix/` |
| `/contains/` | Often broad scan behavior |
| `/suffix$/` | Often broad scan behavior |

**Case-insensitive caveat:**

- `$regex` is not collation-aware.
- Case-insensitive indexes do not improve `$regex` performance.
- If you need rich text search behavior (fuzzy, stemming, ranking), use Atlas Search instead of regex.

## Verify with

```javascript
function checkRegexIndexUse(collection, field, regex) {
  const exp = db[collection].find({ [field]: regex }).explain("executionStats")
  const stats = exp.executionStats

  print(`regex: ${regex}`)
  print(`docsExamined: ${stats.totalDocsExamined}`)
  print(`keysExamined: ${stats.totalKeysExamined}`)
  print(`nReturned: ${stats.nReturned}`)
}

checkRegexIndexUse("users", "email", /^alice/)
checkRegexIndexUse("users", "email", /gmail/)
```

Reference: [Regular Expressions](https://mongodb.com/docs/manual/reference/operator/query/regex/)
