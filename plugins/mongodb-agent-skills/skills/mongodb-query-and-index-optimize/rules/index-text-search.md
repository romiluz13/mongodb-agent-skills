---
title: Use Text Indexes for Full-Text Search
impact: HIGH
impactDescription: "Keyword search across documents: text index with stemming and ranking vs regex COLLSCAN"
tags: index, text, search, fulltext, keywords, stemming, ranking
---

## Use Text Indexes for Full-Text Search

**Text indexes enable efficient keyword search with stemming, stop words, and relevance ranking.** Searching for "running" matches "run", "runs", "runner" automatically. Without text indexes, you'd need regex patterns that can't use regular indexes and scan every document. For production search, consider Atlas Search for more features.

**Incorrect (regex for keyword search—COLLSCAN):**

```javascript
// Search for articles about "running"
db.articles.find({ content: /running/i })

// Problems:
// 1. COLLSCAN: Scans every document (unanchored regex)
// 2. No stemming: Misses "run", "runs", "runner"
// 3. No ranking: All matches treated equally
// 4. Case handling: Manual /i flag needed
// 5. Performance: O(n) where n = all documents

// On 1M articles: 30+ seconds for a simple search

// Trying to match variations manually:
db.articles.find({
  content: { $regex: /\b(run|runs|running|runner)\b/i }
})
// Still COLLSCAN, and you missed "ran"
```

**Correct (text index with stemming and ranking):**

```javascript
// Create text index
db.articles.createIndex({ title: "text", content: "text" })

// Search with $text operator
db.articles.find({
  $text: { $search: "running" }
})

// Automatic features:
// - Stemming: "running" matches run, runs, running, runner
// - Stop words: Common words (the, is, a) ignored
// - Case insensitive: Built-in
// - Relevance score: Available via $meta

// With relevance ranking:
db.articles.find(
  { $text: { $search: "running marathon training" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })

// Returns articles ranked by relevance
// More matches = higher score
```

**Text search syntax:**

```javascript
// Single word
db.articles.find({ $text: { $search: "mongodb" } })
// Matches: mongodb, MongoDB, MongoDBs (stemmed)

// Multiple words (OR by default)
db.articles.find({ $text: { $search: "mongodb database" } })
// Matches documents with "mongodb" OR "database"

// Phrase search (exact phrase in quotes)
db.articles.find({ $text: { $search: "\"mongodb database\"" } })
// Matches exact phrase "mongodb database"

// Exclude words (negation with -)
db.articles.find({ $text: { $search: "database -sql" } })
// Matches "database" but NOT "sql"

// Combined: phrase + words + exclusion
db.articles.find({
  $text: { $search: "\"nosql database\" mongodb -deprecated" }
})
// Phrase "nosql database" OR word "mongodb", excluding "deprecated"
```

**Text index on multiple fields:**

```javascript
// Index multiple fields
db.products.createIndex({
  name: "text",
  description: "text",
  tags: "text"
})

// Search across all indexed fields
db.products.find({ $text: { $search: "wireless headphones" } })
// Searches name, description, AND tags

// Weight fields differently
db.products.createIndex(
  {
    name: "text",
    description: "text",
    tags: "text"
  },
  {
    weights: {
      name: 10,        // Title matches worth 10×
      tags: 5,         // Tag matches worth 5×
      description: 1   // Description matches baseline
    }
  }
)

// Now "headphones" in title scores higher than in description
```

**Language and stemming:**

```javascript
// Default language (English)
db.articles.createIndex(
  { content: "text" },
  { default_language: "english" }
)
// Stems: running → run, better → good, mice → mouse

// Other languages
db.articles.createIndex(
  { content: "text" },
  { default_language: "spanish" }
)
// Spanish stemming: corriendo → correr

// Per-document language
db.articles.createIndex(
  { content: "text" },
  { language_override: "lang" }  // Field specifying document language
)

// Document with language:
{
  content: "Bonjour le monde",
  lang: "french"
}

// Disable stemming ("none" language)
db.articles.createIndex(
  { content: "text" },
  { default_language: "none" }
)
// Exact word matching only
```

**Text index limitations:**

```javascript
// ONE text index per collection
db.articles.createIndex({ title: "text" })
db.articles.createIndex({ content: "text" })  // ERROR: Already has text index

// Combine all text fields in one index:
db.articles.createIndex({ title: "text", content: "text", summary: "text" })

// No compound with text as non-first field
db.articles.createIndex({ title: "text", authorId: 1 })  // ✓ OK
db.articles.createIndex({ authorId: 1, title: "text" })  // ✗ ERROR

// Combine text search with other filters:
db.articles.find({
  $text: { $search: "mongodb" },
  status: "published",
  authorId: "author1"
})
// Works, but only $text uses text index
// Other filters need separate indexes or scan results
```

**Text search vs Atlas Search:**

```javascript
// Built-in text index:
// ✓ Basic keyword search
// ✓ Stemming and stop words
// ✓ Simple relevance ranking
// ✗ No fuzzy matching (typo tolerance)
// ✗ No autocomplete
// ✗ No facets/aggregations
// ✗ Limited analyzers

// Atlas Search (recommended for production):
db.products.aggregate([
  {
    $search: {
      index: "default",
      text: {
        query: "wireles headphons",  // Typos!
        path: ["name", "description"],
        fuzzy: { maxEdits: 2 }  // Tolerates typos
      }
    }
  },
  {
    $project: {
      name: 1,
      score: { $meta: "searchScore" }
    }
  }
])
// Features: fuzzy, autocomplete, facets, synonyms, custom analyzers

// Recommendation:
// - Dev/simple use: Built-in text index
// - Production search: Atlas Search
```

**When NOT to use text indexes:**

- **Prefix/autocomplete search**: Text indexes don't support partial word matching. Use Atlas Search or regex with anchored patterns.
- **Numeric search**: Text indexes are for text. Use regular indexes for numeric ranges.
- **Complex search requirements**: Facets, fuzzy matching, synonyms → Atlas Search.
- **Single field exact match**: Regular index more efficient for exact string match.
- **Memory constraints**: Text indexes can be large. Consider Atlas Search for scalability.

## Verify with

```javascript
// Check text index and search performance
function analyzeTextSearch(collection, searchTerms) {
  // Check for text index
  const indexes = db[collection].getIndexes()
  const textIndex = indexes.find(i =>
    Object.values(i.key).includes("text")
  )

  if (!textIndex) {
    print(`No text index on ${collection}`)
    print(`Create with: db.${collection}.createIndex({ field: "text" })`)
    return
  }

  print(`Text index: ${textIndex.name}`)
  print(`Fields: ${Object.keys(textIndex.key).filter(k => textIndex.key[k] === "text").join(", ")}`)
  print(`Language: ${textIndex.default_language || "english"}`)

  if (textIndex.weights) {
    print(`Weights: ${JSON.stringify(textIndex.weights)}`)
  }

  // Test search
  const explain = db[collection].find({
    $text: { $search: searchTerms }
  }).explain("executionStats")

  const stats = explain.executionStats
  print(`\nSearch for "${searchTerms}":`)
  print(`  Results: ${stats.nReturned}`)
  print(`  Docs examined: ${stats.totalDocsExamined}`)
  print(`  Time: ${stats.executionTimeMillis}ms`)

  // Show top results with scores
  const results = db[collection].find(
    { $text: { $search: searchTerms } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } }).limit(5).toArray()

  print(`\nTop 5 results:`)
  results.forEach((doc, i) => {
    print(`  ${i+1}. Score: ${doc.score.toFixed(2)} - ${doc.title || doc._id}`)
  })
}

// Usage
analyzeTextSearch("articles", "mongodb database performance")
```

Reference: [Text Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-text/)
