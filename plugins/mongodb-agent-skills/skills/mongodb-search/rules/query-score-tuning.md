---
title: Tune Score Modifiers with Controlled Weights
impact: HIGH
impactDescription: Improves ranking quality while avoiding unstable score inflation
tags: scoring, boost, constant, function, relevance
---

## Tune Score Modifiers with Controlled Weights

**Impact: HIGH (score abuse can hide relevant documents)**

Use score modifiers (`boost`, `constant`, `function`) with explicit hypotheses and bounded values. Large arbitrary boosts can dominate ranking and mask relevant results.

**Incorrect (unbounded boost):**

```javascript
{
  $search: {
    text: {
      query: "database",
      path: "title",
      score: { boost: { value: 1000 } }
    }
  }
}
```

**Correct (bounded, testable scoring):**

```javascript
db.docs.aggregate([
  {
    $search: {
      compound: {
        must: [{ text: { query: "database", path: "title" } }],
        should: [
          {
            text: {
              query: "mongodb",
              path: "body",
              score: { boost: { value: 2.0 } }
            }
          }
        ]
      }
    }
  },
  { $project: { title: 1, score: { $meta: "searchScore" } } }
])
```

## Score Debugging with scoreDetails

```javascript
// scoreDetails: understand WHY a document received its score
// Enable during development/debugging ONLY — has a performance cost in production

db.collection.aggregate([
  { $search: {
    compound: { must: [{ text: { query: "atlas", path: "title" } }] },
    scoreDetails: true   // ← enable score breakdown
  }},
  { $project: {
    title: 1,
    score: { $meta: "searchScore" },
    details: { $meta: "searchScoreDetails" }  // Lucene score explanation per operator
  }}
])
// details shows: base score, boost multipliers, field weights per clause
// Disable scoreDetails in production — it increases query CPU cost
```

**How to verify:**

- Compare top-k relevance before/after score changes.
- Ensure score changes are documented per query family.

**When NOT to use this pattern:**

- Default relevance is already meeting quality targets.

Reference: [How to Customize Score](https://www.mongodb.com/docs/atlas/atlas-search/customize-score.md)
Reference: [Scoring](https://www.mongodb.com/docs/atlas/atlas-search/scoring.md)
