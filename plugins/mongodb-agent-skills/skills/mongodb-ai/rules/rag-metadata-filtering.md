---
title: RAG Metadata Filtering
impact: HIGH
impactDescription: Filters improve relevance and enable scoped searches
tags: RAG, filter, metadata, pre-filter, scoped-search
---

## RAG Metadata Filtering

Use metadata filters to scope RAG searches by source, date, category, or user permissions.

**Incorrect (no filtering):**

```javascript
// WRONG: Search entire knowledge base without scoping
const context = await db.ragChunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 200,
      limit: 5
      // No filter - searches everything
    }
  }
]).toArray()
// Result: May return outdated docs, wrong department, or unauthorized content
```

**Correct (metadata-scoped retrieval):**

```javascript
// Time-scoped: Recent documents only
async function retrieveRecent(query, daysBack = 90) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)

  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          "metadata.createdAt": { $gte: cutoffDate }
        }
      }
    }
  ]).toArray()
}

// Category-scoped: Specific knowledge domain
async function retrieveByCategory(query, category) {
  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          "metadata.category": category
        }
      }
    }
  ]).toArray()
}

// Source-scoped: Specific document or collection
async function retrieveFromSource(query, sourceId) {
  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          "source.documentId": ObjectId(sourceId)
        }
      }
    }
  ]).toArray()
}

// Permission-scoped: User-authorized content
async function retrieveAuthorized(query, userId, userRoles) {
  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: {
          $or: [
            { "metadata.visibility": "public" },
            { "metadata.authorId": userId },
            { "metadata.allowedRoles": { $in: userRoles } }
          ]
        }
      }
    }
  ]).toArray()
}
```

**Complex Filter Patterns:**

```javascript
// Multi-dimensional filter
async function advancedRetrieval(query, filters) {
  const {
    category,
    dateRange,
    sources,
    excludeTags,
    userId
  } = filters

  const filterConditions = []

  if (category) {
    filterConditions.push({ "metadata.category": category })
  }

  if (dateRange) {
    filterConditions.push({
      "metadata.createdAt": {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    })
  }

  if (sources?.length) {
    filterConditions.push({
      "source.documentId": { $in: sources.map(s => ObjectId(s)) }
    })
  }

  if (excludeTags?.length) {
    filterConditions.push({
      "metadata.tags": { $nin: excludeTags }
    })
  }

  // Always enforce authorization
  filterConditions.push({
    $or: [
      { "metadata.visibility": "public" },
      { "metadata.authorId": userId }
    ]
  })

  return await db.ragChunks.aggregate([
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        queryVector: await embed(query),
        numCandidates: 200,
        limit: 5,
        filter: filterConditions.length > 1
          ? { $and: filterConditions }
          : filterConditions[0]
      }
    }
  ]).toArray()
}
```

**Index Definition for Metadata Filtering:**

```javascript
db.ragChunks.createSearchIndex("rag_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    // All filterable metadata fields
    { type: "filter", path: "metadata.category" },
    { type: "filter", path: "metadata.createdAt" },
    { type: "filter", path: "metadata.visibility" },
    { type: "filter", path: "metadata.authorId" },
    { type: "filter", path: "metadata.allowedRoles" },
    { type: "filter", path: "metadata.tags" },
    { type: "filter", path: "source.documentId" }
  ]
})
```

**User Interface Filter Options:**

```javascript
// API endpoint with filter parameters
app.post('/api/rag/search', async (req, res) => {
  const {
    query,
    filters: {
      category = null,
      startDate = null,
      endDate = null,
      sources = null
    }
  } = req.body

  const context = await advancedRetrieval(query, {
    category,
    dateRange: startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : null,
    sources,
    userId: req.user.id
  })

  res.json({ context })
})
```

**When NOT to use this pattern:**

- Very small knowledge bases (filtering may return nothing)
- Open-ended exploration queries
- When filter fields aren't indexed

Reference: [MongoDB $vectorSearch Filter](https://mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/#std-label-vectorSearch-filter)
