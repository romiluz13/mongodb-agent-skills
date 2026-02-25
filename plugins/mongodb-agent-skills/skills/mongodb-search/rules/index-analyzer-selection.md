---
title: Select Analyzers and Operators as a Matched Pair
impact: CRITICAL
impactDescription: Improves relevance and avoids operator/analyzer mismatch
tags: analyzers, text, phrase, autocomplete, queryString
---

## Select Analyzers and Operators as a Matched Pair

**Impact: CRITICAL (analyzer/operator mismatch causes relevance failures)**

Choose analyzer and operator together. `text`, `phrase`, `autocomplete`, and `queryString` have different semantics and index requirements.

**Incorrect (single catch-all operator):**

```javascript
// WRONG: queryString used for all UX modes
db.movies.aggregate([
  {
    $search: {
      queryString: {
        defaultPath: "title",
        query: "star wars"
      }
    }
  }
])
```

**Correct (intent-specific operators):**

```javascript
// Exact order intent -> phrase
{ $search: { phrase: { query: "star wars", path: "title" } } }

// General full text intent -> text
{ $search: { text: { query: "galactic battle", path: "plot" } } }

// Type-ahead intent -> autocomplete
{ $search: { autocomplete: { query: "sta", path: "title" } } }
```

**How to verify:**

- Relevance tests are grouped by query intent (exact phrase, full text, type-ahead).
- Query plans and scores reflect intended behavior.

**When NOT to use this pattern:**

- Very small internal tools where precision tradeoffs are acceptable.

Reference: [Text Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/text.md)
Reference: [Phrase Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/phrase.md)
Reference: [Autocomplete Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/autocomplete.md)
Reference: [QueryString Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/queryString.md)
