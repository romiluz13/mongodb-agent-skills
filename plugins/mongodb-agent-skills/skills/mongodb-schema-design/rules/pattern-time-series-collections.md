---
title: Use Time Series Collections for Time Series Data
impact: MEDIUM
impactDescription: "10-100× lower storage and index overhead with automatic bucketing and compression"
tags: schema, patterns, time-series, collections, bucketing, ttl, granularity
---

## Use Time Series Collections for Time Series Data

**Time series collections are purpose-built for append-only measurements.** MongoDB automatically buckets, compresses, and indexes time series data so you get high ingest rates with far less storage and index overhead than a standard collection.

**Incorrect (regular collection for measurements):**

```javascript
// Regular collection: one document per reading
// Creates huge collections and indexes at scale
{
  sensorId: "temp-01",
  ts: ISODate("2025-01-15T10:00:00Z"),
  value: 22.5
}

// Standard index (large and grows fast)
db.sensor_data.createIndex({ sensorId: 1, ts: 1 })
```

**Correct (time series collection with metadata):**

```javascript
// Native time series collection
// MongoDB buckets and compresses automatically

// Create the collection once
// timeField = timestamp, metaField = shared metadata
// granularity tunes bucket size for query patterns
// expireAfterSeconds enables automatic retention

db.createCollection("sensor_data", {
  timeseries: {
    timeField: "ts",
    metaField: "sensorId",
    granularity: "seconds"
  },
  expireAfterSeconds: 60 * 60 * 24 * 30
})

// Insert as one document per measurement
// MongoDB stores buckets internally

db.sensor_data.insertOne({
  sensorId: "temp-01",
  ts: new Date(),
  value: 22.5
})
```

**When NOT to use this pattern:**

- **Not time-based data**: If the primary access is not time range queries.
- **Frequent updates to old measurements**: Updates/deletes inside buckets are slower.
- **Very low volume**: If you only store a few hundred events total.

**Verify with:**

```javascript
// Confirm the collection is time series
// Look for the "timeseries" section in the options

db.getCollectionInfos({ name: "sensor_data" })
```

Reference: [Time Series Collections](https://mongodb.com/docs/manual/core/timeseries-collections/)
