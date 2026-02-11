---
title: Anchor Regex Patterns with ^
impact: HIGH
impactDescription: "Anchored regex uses index (5ms); unanchored forces COLLSCAN (30 seconds on 10M docs)"
tags: query, regex, text-search, index-usage, performance, autocomplete
---

## Anchor Regex Patterns with ^

**Only regex patterns starting with `^` can use indexes—unanchored patterns force a full collection scan.** An index on `email` makes `/^alice/` fast (seeks to "alice" range), but `/gmail/` must check every single document regardless of indexes. This is often a 1000× performance difference.

**Incorrect (unanchored regex—COLLSCAN regardless of index):**

```javascript
// "Find users with gmail addresses"
db.users.find({ email: /gmail/ })

// What you expect: Use index on email, find gmail matches
// What happens: FULL COLLECTION SCAN

// Even with index:
db.users.createIndex({ email: 1 })

// explain() shows:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN"  // Full scan despite index!
    }
  },
  "executionStats": {
    "totalDocsExamined": 10000000,  // All 10M docs
    "executionTimeMillis": 32000    // 32 seconds
  }
}

// Why? "gmail" could be ANYWHERE in string:
// - alice@gmail.com ✓
// - bob@gmail.co.uk ✓
// - gmail_user@yahoo.com ✓ (contains "gmail")
// Index can't help—must check every value
```

**Correct (anchored regex—efficient IXSCAN):**

```javascript
// "Find users whose email starts with 'alice'"
db.users.find({ email: /^alice/ })

// Index CAN be used because:
// - All matches start with "alice"
// - Index is sorted alphabetically
// - Seek to "alice", scan until "alicf" (first non-match)

// explain() shows:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "IXSCAN",
      "indexName": "email_1",
      "indexBounds": {
        "email": [
          "[\"alice\", \"alicf\")",  // Bounded range!
          "[/^alice/, /^alice/]"
        ]
      }
    }
  },
  "executionStats": {
    "totalKeysExamined": 1547,     // Only ~1500 entries
    "totalDocsExamined": 1547,
    "executionTimeMillis": 5       // 5ms vs 32 seconds!
  }
}
```

**Common anchored regex patterns:**

```javascript
// Autocomplete: user types "jo"
db.users.createIndex({ name: 1 })
db.users.find({ name: /^jo/i })  // Case-insensitive anchor
// Returns: John, Joseph, Joanna, jonathan...

// Prefix matching: product SKUs
db.products.createIndex({ sku: 1 })
db.products.find({ sku: /^ELEC-2024-/ })
// Returns: ELEC-2024-001, ELEC-2024-002...

// Path prefix: file system queries
db.files.createIndex({ path: 1 })
db.files.find({ path: /^\/home\/alice\/documents\// })
// Returns all files in alice's documents folder

// Version prefix: semantic versioning
db.packages.createIndex({ version: 1 })
db.packages.find({ version: /^2\./ })
// Returns: 2.0.0, 2.1.0, 2.15.3...
```

**Regex pattern performance matrix:**

| Pattern | Index Used | Explanation |
|---------|------------|-------------|
| `/^prefix/` | ✅ Yes | Anchored start—bounded range scan |
| `/^prefix/i` | ✅ Yes | Case-insensitive but still anchored |
| `/^prefix.*suffix$/` | ⚠️ Partial | Uses index for prefix, filters suffix |
| `/suffix$/` | ❌ No | End anchor—must scan all |
| `/contains/` | ❌ No | Substring—must scan all |
| `/.*any.*/` | ❌ No | Greedy match—must scan all |
| `/^(a|b|c)/` | ❌ No | Alternation breaks anchoring |

**Alternatives for substring search:**

```javascript
// OPTION 1: Text Index (built-in, good for keywords)
db.articles.createIndex({ title: "text", content: "text" })
db.articles.find({ $text: { $search: "mongodb" } })
// Tokenized search, handles stemming
// Limitation: Word boundaries only, no partial matches

// OPTION 2: Atlas Search (recommended for production)
db.products.aggregate([
  {
    $search: {
      index: "default",  // Atlas Search index
      autocomplete: {    // Partial match support
        query: "lapt",
        path: "name",
        fuzzy: { maxEdits: 1 }  // Typo tolerance
      }
    }
  },
  { $limit: 10 },
  { $project: { name: 1, score: { $meta: "searchScore" } } }
])
// Features: fuzzy matching, synonyms, facets, highlighting
// Much faster than regex for complex search

// OPTION 3: Computed search field (DIY approach)
// Store lowercase, no-spaces version for searching
{
  name: "John Smith",
  nameSearch: "johnsmith"  // Index this
}
db.users.createIndex({ nameSearch: 1 })
db.users.find({ nameSearch: /^john/ })  // Anchored on normalized field
```

**When NOT to worry about anchored regex:**

- **Small collections**: <10K documents, COLLSCAN is fast anyway.
- **Rare queries**: Admin-only search run occasionally.
- **Already filtered**: `{ tenantId: "x", name: /smith/ }` where tenantId reduces to small set first.
- **Text/Atlas Search available**: Use proper search instead of regex.

## Verify with

```javascript
// Check if regex can use index
function checkRegexIndexUse(collection, field, pattern) {
  const regex = new RegExp(pattern)
  const explain = db[collection]
    .find({ [field]: regex })
    .explain("executionStats")

  const plan = JSON.stringify(explain.queryPlanner.winningPlan)
  const usesIndex = plan.includes("IXSCAN")
  const stage = explain.queryPlanner.winningPlan.stage

  print(`Pattern: /${pattern}/`)
  print(`Stage: ${stage}`)
  print(`Uses index: ${usesIndex ? "YES ✓" : "NO - COLLSCAN"}`)
  print(`Docs examined: ${explain.executionStats.totalDocsExamined}`)
  print(`Time: ${explain.executionStats.executionTimeMillis}ms`)

  if (!usesIndex && !pattern.startsWith("^")) {
    print(`\n💡 TIP: Add ^ anchor: /^${pattern}/`)
  }
}

// Usage
checkRegexIndexUse("users", "email", "gmail")      // No index
checkRegexIndexUse("users", "email", "^alice")     // Uses index
```

Reference: [Regular Expressions](https://mongodb.com/docs/manual/reference/operator/query/regex/)
