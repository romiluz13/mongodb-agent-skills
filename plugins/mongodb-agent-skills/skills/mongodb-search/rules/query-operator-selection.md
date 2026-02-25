---
title: Choose Search Operator by Intent
impact: CRITICAL
impactDescription: Improves precision and recall by matching operator semantics to UX intent
tags: operator-selection, text, phrase, autocomplete, queryString
---

## Choose Search Operator by Intent

**Impact: CRITICAL (operator misuse causes wrong matches and poor UX)**

Use operator semantics intentionally:
- `text` for full-text relevance
- `phrase` for ordered phrase constraints
- `autocomplete` for type-ahead
- `queryString` for advanced fielded boolean query expressions

**Incorrect (one operator for all query modes):**

```javascript
// WRONG: queryString used for type-ahead and phrase search
{ $search: { queryString: { defaultPath: "title", query: "sta" } } }
```

**Correct (intent-routed operators):**

```javascript
// Type-ahead
{ $search: { autocomplete: { query: "sta", path: "title" } } }

// Exact phrase intent
{ $search: { phrase: { query: "star wars", path: "title" } } }

// Broad text intent
{ $search: { text: { query: "galactic rebellion", path: "plot" } } }
```

**How to verify:**

- Query suite maps each endpoint or UI mode to a specific operator.
- Relevance tests confirm expected top-k behavior by mode.

**When NOT to use this pattern:**

- None. Operator intent should always be explicit.

Reference: [Text Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/text.md)
Reference: [Phrase Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/phrase.md)
Reference: [Autocomplete Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/autocomplete.md)
Reference: [QueryString Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/queryString.md)
