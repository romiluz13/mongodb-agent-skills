---
title: RAG Ingestion Pattern
impact: HIGH
impactDescription: Proper ingestion enables effective semantic retrieval
tags: RAG, ingestion, embedding, chunking, metadata
---

## RAG Ingestion Pattern

Proper RAG ingestion includes chunking, embedding, and storing metadata. Poor ingestion leads to retrieval failures.

**Incorrect (naive ingestion):**

```javascript
// WRONG: No chunking - dilutes embedding relevance
await db.documents.insertOne({
  content: entireLargeDocument,  // 50,000 words as one chunk!
  embedding: await embed(entireLargeDocument)
})
// Result: Embedding averages over too much content, loses specificity

// WRONG: No metadata - can't filter or trace source
await db.documents.insertOne({
  content: chunk,
  embedding: await embed(chunk)
  // No source, date, category, or tracking info
})
```

**Correct (structured ingestion):**

```javascript
// Proper RAG document schema
const ragDocumentSchema = {
  // Content
  content: String,        // The chunk text
  embedding: [Number],    // Vector embedding

  // Source tracking
  source: {
    documentId: ObjectId, // Original document
    fileName: String,
    url: String,
    pageNumber: Number
  },

  // Chunking info
  chunk: {
    index: Number,        // Position in original doc
    totalChunks: Number,
    startChar: Number,
    endChar: Number
  },

  // Metadata for filtering
  metadata: {
    category: String,
    author: String,
    createdAt: Date,
    lastUpdated: Date
  },

  // Embedding info
  embeddingModel: String,
  embeddingDimensions: Number
}

// Complete ingestion function
async function ingestDocument(document, embeddingClient) {
  // Step 1: Chunk the document
  const chunks = chunkDocument(document.content, {
    chunkSize: 1000,      // ~1000 characters per chunk
    overlap: 200          // 200 char overlap for context
  })

  // Step 2: Generate embeddings for all chunks
  const embeddings = await embeddingClient.embedBatch(
    chunks.map(c => c.text)
  )

  // Step 3: Store with full metadata
  const docs = chunks.map((chunk, i) => ({
    content: chunk.text,
    embedding: embeddings[i],

    source: {
      documentId: document._id,
      fileName: document.fileName,
      url: document.url
    },

    chunk: {
      index: i,
      totalChunks: chunks.length,
      startChar: chunk.start,
      endChar: chunk.end
    },

    metadata: {
      category: document.category,
      author: document.author,
      createdAt: new Date(),
      lastUpdated: new Date()
    },

    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536
  }))

  await db.ragChunks.insertMany(docs)
}
```

**Chunking Strategy:**

```javascript
// Simple overlap chunking
function chunkDocument(text, { chunkSize = 1000, overlap = 200 }) {
  const chunks = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push({
      text: text.slice(start, end),
      start,
      end
    })
    start += chunkSize - overlap
  }

  return chunks
}

// Semantic chunking (better quality)
function chunkByParagraphs(text, maxChunkSize = 1500) {
  const paragraphs = text.split(/\n\n+/)
  const chunks = []
  let currentChunk = ""

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = para
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks
}
```

**Index for RAG Collection:**

```javascript
db.ragChunks.createSearchIndex("rag_vector_index", "vectorSearch", {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    { type: "filter", path: "metadata.category" },
    { type: "filter", path: "source.documentId" },
    { type: "filter", path: "metadata.createdAt" }
  ]
})
```

**When NOT to use this pattern:**

- Very short documents (no chunking needed)
- Structured data (embed individual fields instead)
- Real-time streaming (requires incremental approach)

Reference: [MongoDB RAG Implementation](https://mongodb.com/docs/atlas/atlas-vector-search/rag/)
