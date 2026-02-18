---
title: Lexical Prefilters for Vector Search
impact: CRITICAL
impactDescription: Advanced text filtering (fuzzy, phrase, geo, wildcard) before vector search
tags: lexical-prefilter, vectorSearch-operator, $search, fuzzy, phrase, wildcard, preview
---

## Lexical Prefilters for Vector Search

**Public Preview (November 2025)**: The `vectorSearch` operator inside `$search` enables advanced text analysis filters (fuzzy, phrase, geo, wildcard) BEFORE vector search. This is distinct from the `$vectorSearch` aggregation stage.

**Key Difference:**

| Feature | `$vectorSearch` Stage | `$search.vectorSearch` Operator |
|---------|----------------------|--------------------------------|
| Pipeline Position | First stage in aggregation | Inside `$search` stage |
| Pre-filter Type | MQL prefilters (`$eq/$ne`, range, `$in/$nin`, `$exists`, logical) | Atlas Search operators (fuzzy, phrase, geo, wildcard, etc.) |
| Index Type | `vectorSearch` type | Atlas Search index with `vector` field type |
| Use Case | Basic filtering | Advanced lexical + semantic search |

**Incorrect (trying to use analyzed-text prefilters in `$vectorSearch` stage):**

```javascript
// LIMITED FOR ANALYZED TEXT: $vectorSearch filter supports MQL prefilters
// but does NOT support Atlas Search analyzed-text operators.
db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],
      numCandidates: 100,
      limit: 10,
      filter: {
        $and: [
          { category: "electronics" },
          { price: { $gte: 500 } },
          { status: { $ne: "archived" } }
        ]
        // Still cannot do fuzzy, phrase, wildcard, or geoWithin here.
        // Cannot do: fuzzy match on "electronnics"
        // Cannot do: phrase match on "high performance laptop"
        // Cannot do: wildcard "electro*"
      }
    }
  }
])
```

**What `$vectorSearch` Stage Prefilters Do Support:**

```javascript
// MQL filters are broad, as long as fields are indexed as type: "filter"
{
  $and: [
    { category: { $in: ["electronics", "computers"] } },
    { price: { $gte: 500, $lte: 2500 } },
    { discount: { $exists: true } },
    { status: { $not: { $eq: "archived" } } }
  ]
}
```

**Correct (using $search.vectorSearch with lexical prefilters):**

```javascript
// ADVANCED: $search.vectorSearch supports Atlas Search operators
db.products.aggregate([
  {
    $search: {
      index: "search_vector_index",  // Atlas Search index with vector type
      vectorSearch: {
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: {
          compound: {
            must: [
              {
                text: {
                  query: "laptop",
                  path: "description",
                  fuzzy: { maxEdits: 1 }  // Fuzzy matching!
                }
              }
            ],
            should: [
              {
                phrase: {
                  query: "high performance",
                  path: "title"  // Phrase matching!
                }
              }
            ]
          }
        }
      }
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "searchScore" }
    }
  }
])
```

**Index Definition for Lexical Prefilters:**

```javascript
// Atlas Search index with vector type (NOT vectorSearch type!)
db.products.createSearchIndex("search_vector_index", {
  mappings: {
    fields: {
      // Vector field for semantic search
      embedding: {
        type: "vector",
        numDimensions: 1536,
        similarity: "cosine"
      },
      // Text fields for lexical prefilters
      title: {
        type: "string",
        analyzer: "lucene.standard"
      },
      description: {
        type: "string",
        analyzer: "lucene.standard"
      },
      // Location for geo prefilters
      location: {
        type: "geo"
      }
    }
  }
})
```

**Supported Lexical Prefilter Types:**

| Filter Type | Operator | Example Use Case |
|-------------|----------|------------------|
| Fuzzy Search | `text` with `fuzzy` | Match "electronnics" → "electronics" |
| Phrase Match | `phrase` | Match exact phrases "high performance" |
| Wildcard | `wildcard` | Match patterns "electro*" |
| Geo Filter | `geoWithin`, `geoShape` | Filter by location before vector search |
| Range | `range` | Date/number ranges |
| Regex | `regex` | Pattern matching |
| Compound | `compound` | Boolean logic (must, should, mustNot) |

**Geo Prefilter Example:**

```javascript
db.stores.aggregate([
  {
    $search: {
      index: "store_search_index",
      vectorSearch: {
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: {
          geoWithin: {
            path: "location",
            circle: {
              center: { type: "Point", coordinates: [-73.98, 40.75] },
              radius: 5000  // 5km radius
            }
          }
        }
      }
    }
  }
])
```

**Wildcard Prefilter Example:**

```javascript
db.products.aggregate([
  {
    $search: {
      index: "product_search_index",
      vectorSearch: {
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: {
          wildcard: {
            path: "sku",
            query: "ELEC-*-2025"  // Match pattern
          }
        }
      }
    }
  }
])
```

**Why Use Lexical Prefilters:**

1. **Advanced filtering**: Fuzzy, phrase, geo, wildcard not available in `$vectorSearch`
2. **Performance**: Filter before vector comparison (fewer candidates)
3. **Complex logic**: Boolean combinations with `compound` operator
4. **Migration path**: Replaces deprecated `knnBeta` and `knnVector`

**Limitations:**

- `vectorSearch` operator must be top-level (cannot be inside `compound` or `embeddedDocument`)
- Cannot use `highlight`, `sort`, or `searchSequenceToken` options
- Not available in MongoDB Search Playground
- Public Preview - syntax may change

**When NOT to use this pattern:**

- Basic equality filters suffice (use `$vectorSearch` stage instead)
- Not using Atlas Search features
- Need stable GA features (this is Preview)

## Verify with

1. Run the "Correct" index or query example on a staging dataset.
2. Validate expected behavior and performance using explain and Atlas metrics.
3. Confirm version-gated behavior on your target MongoDB release before production rollout.

Reference: [MongoDB vectorSearch Operator](https://mongodb.com/docs/atlas/atlas-search/operators-collectors/vectorSearch/)
