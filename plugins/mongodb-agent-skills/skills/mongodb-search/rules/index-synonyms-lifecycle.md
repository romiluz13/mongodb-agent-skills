---
title: Manage Synonyms as a Controlled Data Source
impact: HIGH
impactDescription: Avoids invalid synonym mappings and surprise relevance shifts
tags: synonyms, relevance, lifecycle, mapping
---

## Manage Synonyms as a Controlled Data Source

**Impact: HIGH (bad synonym data can break index builds and degrade relevance)**

Keep synonym source collections valid and minimal. Atlas Search watches synonym source changes and updates internal synonym maps without reindex, but updates are eventually reflected.

## Restrictions (correctness constraints — violations cause wrong results silently)

1. **Operator scope**: Synonyms work ONLY with `text` and `phrase` operators.
   They do NOT work with `queryString`, `wildcard`, `regex`, `autocomplete`.

2. **Always use `matchCriteria`** when using synonyms with `text`:
   - `"any"` — document matches if any synonym matches
   - `"all"` — document matches only if ALL synonyms match
   Without `matchCriteria`, behavior is undefined.

3. **`fuzzy` and `synonyms` are mutually exclusive** on the `text` operator.
   You cannot use both in the same `text` clause.

4. **Analyzer restrictions**: Cannot use synonym mappings with:
   - `lucene.kuromoji`, `lucene.cjk`
   - Custom analyzers using `nGram`/`edgeGram` tokenizers or token filters
   - `shingle`, `wordDelimiterGraph`, `daitchMokotoffSoundex` token filters

5. **M0 free tier**: Maximum ONE synonym mapping per index.

```javascript
{ $search: {
  text: {
    query: "car",
    path: "description",
    synonyms: "mySynonyms",
    matchCriteria: "any"   // ← always include this with synonyms
  }
}}
```

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
