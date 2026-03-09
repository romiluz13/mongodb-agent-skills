---
title: Use Manual Bucket Pattern Only When Time Series Collections Are Not a Fit
impact: MEDIUM
impactDescription: "Useful for custom bucketing workflows when native time series collections are not the right fit"
tags: schema, patterns, bucket, time-series, iot, metrics, aggregation
---

## Use Manual Bucket Pattern Only When Time Series Collections Are Not a Fit

MongoDB docs recommend **time series collections for most applications that involve bucketing data by time**. Use this manual bucket pattern only when you specifically need custom bucket documents, per-bucket aggregates stored in the same document, or application-controlled bucket lifecycle that native time series collections do not fit.

Use `pattern-time-series-collections` first. Fall back to this rule when native time series collections are not the right match.

**Incorrect (one document per event):**

```javascript
// Sensor readings: 1 document per reading
// Each document ~100 bytes + index entries
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:00Z"), value: 22.5 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:01Z"), value: 22.6 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:02Z"), value: 22.5 }
// ...

// Per sensor per year:
// 86,400 docs/day × 365 days = 31,536,000 documents
// 31M index entries for {sensorId, ts} compound index
// Query for 1 day: scan 86,400 index entries
```

**Correct (bucket pattern - group by time window):**

```javascript
// One document per sensor per hour
// Readings array bounded to ~3,600 elements
{
  sensorId: "temp-01",
  bucket: ISODate("2024-01-15T10:00:00Z"),  // Hour start
  readings: [
    { m: 0, s: 0, value: 22.5 },   // Minute 0, second 0
    { m: 0, s: 1, value: 22.6 },   // Minute 0, second 1
    { m: 0, s: 2, value: 22.5 },
    // ... up to 3,600 readings
  ],
  count: 3600,
  // Pre-computed aggregates - no need to scan array
  sum: 81234.5,
  min: 21.2,
  max: 24.8,
  avg: 22.56
}

// Per sensor per year:
// 24 docs/day × 365 days = 8,760 documents (3,600× fewer)
// 8,760 index entries (3,600× smaller index)
// Query for 1 day: scan 24 index entries
```

**Insert with automatic bucketing:**

```javascript
// Atomic upsert - creates bucket or adds to existing
const reading = { ts: new Date(), value: 22.7 }
const hour = new Date(reading.ts)
hour.setMinutes(0, 0, 0)  // Round to hour

db.sensor_data.updateOne(
  {
    sensorId: "temp-01",
    bucket: hour,
    count: { $lt: 3600 }  // Start new bucket if full
  },
  {
    $push: {
      readings: {
        m: reading.ts.getMinutes(),
        s: reading.ts.getSeconds(),
        value: reading.value
      }
    },
    $inc: { count: 1, sum: reading.value },
    $min: { min: reading.value },
    $max: { max: reading.value }
  },
  { upsert: true }
)
```

**Query patterns:**

```javascript
// Get hourly averages for a day - uses pre-computed values
db.sensor_data.find({
  sensorId: "temp-01",
  bucket: {
    $gte: ISODate("2024-01-15T00:00:00Z"),
    $lt: ISODate("2024-01-16T00:00:00Z")
  }
}, {
  bucket: 1,
  avg: { $divide: ["$sum", "$count"] },
  min: 1,
  max: 1
})
// Returns 24 documents instead of 86,400

// Get specific reading - only when needed
db.sensor_data.findOne(
  { sensorId: "temp-01", bucket: hour },
  { readings: { $elemMatch: { m: 30, s: 15 } } }
)
```

**Preferred default: MongoDB Time Series Collections (5.0+):**

```javascript
// Native time-series support - handles bucketing automatically
db.createCollection("sensor_data", {
  timeseries: {
    timeField: "ts",
    metaField: "sensorId",
    granularity: "seconds"  // or "minutes", "hours"
  },
  expireAfterSeconds: 86400 * 30  // Auto-delete after 30 days
})

// Insert as if one-doc-per-event - MongoDB buckets internally
db.sensor_data.insertOne({
  sensorId: "temp-01",
  ts: new Date(),
  value: 22.5
})
```

**When NOT to use this pattern:**

- **Most time-bucketed workloads**: Start with time series collections before considering manual buckets.
- **Random access patterns**: If you frequently query individual events by ID, not time ranges.
- **Low volume**: If event volume is low, bucketing complexity may outweigh benefits.
- **Varied event sizes**: Bucketing works best when events are uniform size.

## Verify with

```javascript
// Check document counts - should be low for time-series
db.sensor_data.estimatedDocumentCount()
// If count ≈ events, you're not bucketing

// Check average document size
db.sensor_data.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: { _id: null, avgSize: { $avg: "$size" } } }
])
// Compare average document size with query latency and index growth trends
```

Reference: [Bucket Pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/group-data/bucket-pattern/)
Reference: [Time Series Collections](https://www.mongodb.com/docs/manual/core/timeseries/timeseries-collections/)
