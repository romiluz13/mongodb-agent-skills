---
title: Structure compound Clauses for Relevance and Filtering
impact: CRITICAL
impactDescription: Avoids unnecessary scoring work and post-search filtering
tags: compound, must, should, filter, relevance
---

## Structure compound Clauses for Relevance and Filtering

**Impact: CRITICAL (poor clause structure hurts relevance and latency)**

Put scoring criteria in `must` and `should`; put non-scoring filters in `filter`. Avoid pushing core filtering to a post-`$search` `$match` stage.

```javascript
// minimumShouldMatch: controls how many should clauses must match
// Default: 0 (but when only should clauses present, at least 1 must match)

// Use case: require at least 2 of 3 optional criteria to match:
{ $search: {
  compound: {
    should: [
      { text: { query: "mongodb", path: "title" } },
      { text: { query: "atlas", path: "title" } },
      { text: { query: "developer", path: "content" } }
    ],
    minimumShouldMatch: 2  // at least 2 of the 3 must match
  }
}}

// IMPORTANT: when ONLY should (no must), at least 1 must match regardless
// minimumShouldMatch: 0 only means "0 required" when must is also present
```

**Incorrect (post-search match and scoring filters mixed):**

```javascript
db.jobs.aggregate([
  { $search: { text: { query: "mongodb engineer", path: "title" } } },
  { $match: { location: "remote", level: "senior" } }
])
```

**Correct (single search stage with compound):**

```javascript
db.jobs.aggregate([
  {
    $search: {
      compound: {
        must: [
          { text: { query: "mongodb engineer", path: "title" } }
        ],
        filter: [
          { equals: { path: "location", value: "remote" } },
          { equals: { path: "level", value: "senior" } }
        ],
        should: [
          { text: { query: "atlas", path: "skills" } }
        ]
      }
    }
  }
])
```

**How to verify:**

- Query uses `compound.filter` for non-scoring constraints.
- Relevance ranking still reflects `must/should` intent.

**When NOT to use this pattern:**

- Single simple operator query with no filters or ranking preferences.

Reference: [compound Operator](https://www.mongodb.com/docs/atlas/atlas-search/operators-collectors/compound.md)
Reference: [Query Reference](https://www.mongodb.com/docs/atlas/atlas-search/query-ref.md)
