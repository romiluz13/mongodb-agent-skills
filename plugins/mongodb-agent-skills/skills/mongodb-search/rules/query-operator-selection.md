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

## Operator Selection Matrix

| Intent | Operator | Use in |
|--------|----------|--------|
| Full-text search with relevance | `text` | compound.must / compound.should |
| Exact phrase | `phrase` | compound.must |
| Prefix / autocomplete | `autocomplete` | standalone or compound.should |
| User-typed free text (multi-field) | `queryString` | standalone |
| Numeric/date range filtering | `range` | compound.filter |
| Exact value match (bool, objectId, token) | `equals` | compound.filter |
| Multi-value exact match | `in` | compound.filter |
| Field presence check | `exists` | compound.filter |
| Pattern matching (* and ?) | `wildcard` | compound.must (requires string type) |
| Regular expression | `regex` | compound.must (performance: use sparingly) |
| Array-of-objects queries | `embeddedDocument` | standalone (cannot use highlight inside) |
| Similar documents | `moreLikeThis` | standalone |
| Geo shape queries | `geoShape` / `geoWithin` | standalone or compound |
| Typo tolerance | `fuzzy` option on `text`/`autocomplete` | add to text/autocomplete |

Note: `fuzzy` and `synonyms` are mutually exclusive on the `text` operator.
Note: `range`, `equals`, `in`, `exists` used in `compound.filter` do not affect scoring.

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
