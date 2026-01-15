---
title: Anchor Regex Patterns with ^
impact: HIGH
impactDescription: Index usage vs full collection scan
tags: query, regex, text-search, index-usage, performance
---

## Anchor Regex Patterns with ^

Only anchored regex patterns (starting with ^) can use indexes. Unanchored regex forces a full collection scan regardless of indexes.

**Incorrect (unanchored regex, COLLSCAN):**

```javascript
// Search for emails containing "gmail"
db.users.find({ email: /gmail/ })

// Even with index on email, this is a COLLSCAN
// Must check every document for "gmail" anywhere in string
// 10M users = 10M string comparisons
```

**Correct (anchored regex, IXSCAN):**

```javascript
// Search for emails starting with pattern
db.users.find({ email: /^alice/ })

// Uses index on email field
// Jumps to "alice" in index, scans only matching range
// Much faster on large collections
```

**Use cases for anchored regex:**

```javascript
// Autocomplete - user types "jo"
db.users.find({ name: /^jo/i })  // Case-insensitive anchor

// Prefix matching
db.products.find({ sku: /^ELEC-/ })  // All electronics

// Starts-with search
db.files.find({ path: /^\/home\/user123\// })
```

**For substring search, use text index:**

```javascript
// Create text index
db.articles.createIndex({ title: "text", content: "text" })

// Search for keyword anywhere
db.articles.find({ $text: { $search: "mongodb" } })

// Much faster than /mongodb/ regex
```

**For complex search, use Atlas Search:**

```javascript
// Atlas Search supports:
// - Fuzzy matching
// - Synonyms
// - Facets
// - Autocomplete
// - Highlighting

db.products.aggregate([
  {
    $search: {
      autocomplete: {
        query: "lapt",
        path: "name"
      }
    }
  }
])
```

**Regex performance comparison:**

| Pattern | Index Used | Performance |
|---------|------------|-------------|
| `/^prefix/` | Yes | Fast |
| `/^prefix/i` | Yes (case-insensitive) | Fast |
| `/suffix$/` | No | Full scan |
| `/contains/` | No | Full scan |
| `/.*pattern.*/` | No | Full scan |

Reference: [Regular Expressions](https://mongodb.com/docs/manual/reference/operator/query/regex/)
