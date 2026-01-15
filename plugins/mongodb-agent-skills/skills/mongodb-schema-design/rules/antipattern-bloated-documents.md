---
title: Avoid Bloated Documents
impact: CRITICAL
impactDescription: 10-100× memory efficiency improvement
tags: schema, document-size, anti-pattern, working-set, memory, atlas-suggestion
---

## Avoid Bloated Documents

Keep frequently-accessed documents small. Large documents waste RAM because MongoDB loads entire documents into memory, even when queries only need a few fields. Bloated documents reduce working set efficiency and increase I/O.

**Incorrect (everything in one document):**

```javascript
// Product with full history and all images embedded
{
  _id: "prod123",
  name: "Laptop",
  price: 999,
  description: "...", // 5KB text
  fullSpecs: {...},   // 10KB nested object
  images: [...],      // 500KB of base64 encoded images
  reviews: [...],     // 100KB of user reviews
  priceHistory: [...] // 50KB of historical prices
}
// Total: ~665KB per product
```

**Correct (hot data only in main document):**

```javascript
// Product - hot data only (~500 bytes)
{
  _id: "prod123",
  name: "Laptop",
  price: 999,
  thumbnail: "https://cdn.example.com/prod123.jpg",
  avgRating: 4.5,
  reviewCount: 127
}

// Separate collections for cold data
// products_details: { productId, description, fullSpecs }
// products_images: { productId, images: [...] }
// products_reviews: { productId, reviews: [...] }
```

**Rule of thumb:** If your working set documents are over 16KB, split them. Aim for documents under 4KB for frequently-queried collections.

Atlas Schema Suggestions flags this as: "Reduce large documents". A 100× smaller document means 100× more documents fit in RAM.

Reference: [Schema Design Anti-Patterns](https://mongodb.com/docs/manual/data-modeling/design-antipatterns/)
