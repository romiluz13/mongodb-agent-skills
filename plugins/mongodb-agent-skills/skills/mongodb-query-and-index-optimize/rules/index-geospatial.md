---
title: Use Geospatial Indexes for Location Queries
impact: HIGH
impactDescription: "Find nearby locations: 2dsphere index with $near returns results in milliseconds vs scanning all"
tags: index, geospatial, 2dsphere, location, geoJSON, near, distance
---

## Use Geospatial Indexes for Location Queries

**Geospatial indexes enable efficient queries for nearby locations, points within areas, and distance calculations.** Searching for "restaurants within 5km" without a geospatial index means calculating distances for every document. With a 2dsphere index, MongoDB uses spatial data structures to find candidates immediately. For real-world coordinates (lat/long), always use 2dsphere.

**Incorrect (no geospatial index—COLLSCAN):**

```javascript
// Stores with location
{
  _id: "store1",
  name: "Downtown Store",
  location: {
    type: "Point",
    coordinates: [-73.9857, 40.7484]  // [longitude, latitude]
  }
}

// Without geospatial index, can't efficiently query by location
// Would need to calculate distance for EVERY store
db.stores.find({
  // Can't even express "nearby" query without $near
  // $near REQUIRES geospatial index
})

// Manual distance calculation for every document:
// O(n) complexity, slow on large datasets
```

**Correct (2dsphere index for geospatial queries):**

```javascript
// Create 2dsphere index on GeoJSON field
db.stores.createIndex({ location: "2dsphere" })

// Now efficient geospatial queries work:

// Find stores within 5km of a point
db.stores.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9857, 40.7484]  // User's location
      },
      $maxDistance: 5000  // 5km in meters
    }
  }
})
// Returns stores sorted by distance, nearest first
// Uses spatial index for efficient candidate selection

// Find stores within a polygon (delivery zone)
db.stores.find({
  location: {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.0, 40.7],
          [-73.9, 40.7],
          [-73.9, 40.8],
          [-74.0, 40.8],
          [-74.0, 40.7]  // Close the polygon
        ]]
      }
    }
  }
})
```

**GeoJSON format (required for 2dsphere):**

```javascript
// Point (most common)
{
  location: {
    type: "Point",
    coordinates: [-73.9857, 40.7484]  // [longitude, latitude]
  }
}
// IMPORTANT: Order is [longitude, latitude], NOT [lat, long]!

// LineString (routes, paths)
{
  route: {
    type: "LineString",
    coordinates: [
      [-73.9857, 40.7484],
      [-73.9900, 40.7500],
      [-73.9950, 40.7550]
    ]
  }
}

// Polygon (areas, zones)
{
  serviceArea: {
    type: "Polygon",
    coordinates: [[
      [-74.0, 40.7],
      [-73.9, 40.7],
      [-73.9, 40.8],
      [-74.0, 40.8],
      [-74.0, 40.7]  // First and last point must match
    ]]
  }
}
```

**Common geospatial query patterns:**

```javascript
// 1. Find N nearest (with distance)
db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9857, 40.7484] },
      distanceField: "distance",  // Adds distance to results
      maxDistance: 10000,          // 10km
      spherical: true
    }
  },
  { $limit: 10 }
])
// Returns: { ...store, distance: 1234.5 } (meters)

// 2. Find within radius
db.stores.find({
  location: {
    $geoWithin: {
      $centerSphere: [
        [-73.9857, 40.7484],  // Center point
        5 / 6378.1             // 5km / Earth radius in km
      ]
    }
  }
})
// Note: $geoWithin doesn't sort by distance

// 3. Find intersecting geometries
db.deliveryZones.find({
  area: {
    $geoIntersects: {
      $geometry: {
        type: "Point",
        coordinates: [-73.9857, 40.7484]
      }
    }
  }
})
// "Which delivery zones cover this point?"

// 4. $near with min and max distance (ring)
db.stores.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
      $minDistance: 1000,  // At least 1km away
      $maxDistance: 5000   // At most 5km away
    }
  }
})
```

**Compound geospatial indexes:**

```javascript
// Combine geospatial with other fields
db.stores.createIndex({ location: "2dsphere", category: 1 })

// Query: "Restaurants within 5km"
db.stores.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [-73.9857, 40.7484] },
      $maxDistance: 5000
    }
  },
  category: "restaurant"
})
// Both conditions use the compound index

// Important: Geospatial field can be anywhere in compound index
db.stores.createIndex({ category: 1, location: "2dsphere" })
// Also works, different query patterns may prefer different order
```

**2d vs 2dsphere indexes:**

```javascript
// 2dsphere: For real-world Earth coordinates (GeoJSON)
// - Accounts for Earth's spherical shape
// - Distances in meters
// - Supports GeoJSON types
// - USE THIS for lat/long coordinates
db.stores.createIndex({ location: "2dsphere" })

// 2d: For flat (planar) coordinate systems
// - Euclidean geometry (flat plane)
// - Distances in coordinate units
// - Only supports points
// - Use for: game maps, floor plans, non-Earth data
db.gameObjects.createIndex({ position: "2d" })

// Legacy coordinate pairs (2d only):
{
  position: [50, 100]  // x, y coordinates
}

// 2d query example:
db.gameObjects.find({
  position: {
    $near: [50, 100],
    $maxDistance: 10
  }
})
```

**Performance considerations:**

```javascript
// Geospatial queries have specific characteristics:

// 1. $near always returns sorted results (nearest first)
//    Can't combine with .sort() on other fields

// 2. $geoWithin doesn't sort
//    Faster if you don't need distance sorting
//    Can combine with .sort() on other fields

// 3. Use $geoNear aggregation for most control
db.stores.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9, 40.7] },
      distanceField: "dist",
      query: { category: "restaurant", isOpen: true },  // Additional filters
      maxDistance: 5000,
      spherical: true
    }
  },
  { $match: { rating: { $gte: 4 } } },  // Post-filter
  { $limit: 20 }
])

// 4. Large result sets: Add $maxDistance to bound query
// Without maxDistance, may scan entire index
```

**When NOT to use 2dsphere:**

- **Non-geographic data**: Game coordinates, floor plans → use 2d index.
- **Simple bounding box**: If just filtering by lat/long ranges, regular compound index may suffice.
- **Text location**: If locations are addresses (not coordinates), you need geocoding first.
- **Very high precision required**: Geospatial indexes have precision limits.

**Verify with:**

```javascript
// Analyze geospatial index and query
function analyzeGeoQuery(collection, centerPoint, maxDistanceMeters) {
  // Check for geospatial index
  const indexes = db[collection].getIndexes()
  const geoIndex = indexes.find(i =>
    Object.values(i.key).some(v => v === "2dsphere" || v === "2d")
  )

  if (!geoIndex) {
    print(`No geospatial index on ${collection}`)
    return
  }

  print(`Geospatial index: ${geoIndex.name}`)
  print(`Type: ${Object.values(geoIndex.key).find(v => v === "2dsphere" || v === "2d")}`)

  // Test query
  const explain = db[collection].find({
    [Object.keys(geoIndex.key)[0]]: {
      $near: {
        $geometry: { type: "Point", coordinates: centerPoint },
        $maxDistance: maxDistanceMeters
      }
    }
  }).explain("executionStats")

  const stats = explain.executionStats
  print(`\nQuery: $near within ${maxDistanceMeters}m`)
  print(`  Results: ${stats.nReturned}`)
  print(`  Index keys examined: ${stats.totalKeysExamined}`)
  print(`  Docs examined: ${stats.totalDocsExamined}`)
  print(`  Time: ${stats.executionTimeMillis}ms`)

  // Show sample distances
  const results = db[collection].aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: centerPoint },
        distanceField: "distance",
        maxDistance: maxDistanceMeters,
        spherical: true
      }
    },
    { $limit: 5 }
  ]).toArray()

  print(`\nNearest 5:`)
  results.forEach((doc, i) => {
    print(`  ${i+1}. ${doc.name || doc._id} - ${doc.distance.toFixed(0)}m`)
  })
}

// Usage: Find stores near Times Square
analyzeGeoQuery("stores", [-73.9857, 40.7580], 5000)
```

---

## ⚠️ Before You Implement

**I recommend a geospatial index, but please verify first:**

| Check | Why It Matters | How to Verify |
|-------|----------------|---------------|
| No existing 2dsphere index | Avoid duplicate indexes | `db.collection.getIndexes()` |
| GeoJSON format correct | Must be `{type: "Point", coordinates: [lng, lat]}` | Sample documents |
| Coordinates are [lng, lat] | NOT [lat, lng] - common mistake! | Verify sample data |

**Check for existing geospatial index:**
```javascript
db.collection.getIndexes().filter(i =>
  Object.values(i.key).some(v => v === "2dsphere" || v === "2d")
)
```

**Validate GeoJSON format:**
```javascript
db.collection.findOne({}, { location: 1 })
// Should show: { type: "Point", coordinates: [longitude, latitude] }
```

**Interpretation:**
- ✅ No geo index + valid GeoJSON: Safe to create
- ⚠️ Coordinates may be [lat, lng]: Fix data before indexing
- 🔴 Geo index already exists: No action needed

---

## 🔌 MongoDB MCP Auto-Verification

If MongoDB MCP is connected, ask me to verify before implementing.

**What I'll check:**
- `mcp__mongodb__collection-indexes` - Check for existing geo indexes
- `mcp__mongodb__find` - Sample documents to verify GeoJSON format

**Just ask:** "Verify if I can add a geospatial index on [collection]"

---

Reference: [Geospatial Indexes](https://mongodb.com/docs/manual/core/indexes/index-types/index-geospatial/)
