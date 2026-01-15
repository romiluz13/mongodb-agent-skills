---
title: Use Bucket Pattern for Time-Series Data
impact: MEDIUM
impactDescription: 10-100× reduction in document count, improved query performance
tags: schema, patterns, bucket, time-series, iot, metrics
---

## Use Bucket Pattern for Time-Series Data

Group time-series data into buckets instead of one document per event. Reduces document count, index size, and query overhead for time-based data like metrics, logs, or IoT readings.

**Incorrect (one document per event):**

```javascript
// Sensor readings: 1 document per reading
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:00"), value: 22.5 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:01"), value: 22.6 }
{ sensorId: "temp-01", ts: ISODate("2024-01-15T10:00:02"), value: 22.5 }
// 86,400 documents per sensor per day
// 31M documents per sensor per year
```

**Correct (bucket pattern - group by time):**

```javascript
// One document per sensor per hour
{
  sensorId: "temp-01",
  bucket: ISODate("2024-01-15T10:00:00"), // hour bucket
  readings: [
    { ts: ISODate("2024-01-15T10:00:00"), value: 22.5 },
    { ts: ISODate("2024-01-15T10:00:01"), value: 22.6 },
    { ts: ISODate("2024-01-15T10:00:02"), value: 22.5 }
    // ... up to 3,600 readings per hour
  ],
  count: 3600,
  sum: 81234.5,
  min: 21.2,
  max: 24.8
}
// 24 documents per sensor per day
// 8,760 documents per sensor per year (3,600× fewer)
```

**Insert with automatic bucketing:**

```javascript
db.sensor_data.updateOne(
  {
    sensorId: "temp-01",
    bucket: new Date(reading.ts.setMinutes(0, 0, 0)), // round to hour
    count: { $lt: 3600 } // limit bucket size
  },
  {
    $push: { readings: { ts: reading.ts, value: reading.value } },
    $inc: { count: 1, sum: reading.value },
    $min: { min: reading.value },
    $max: { max: reading.value }
  },
  { upsert: true }
)
```

**Benefits:**
- Fewer documents = smaller indexes
- Pre-computed aggregates (sum, min, max)
- Efficient range queries on buckets
- Bounded array size

**Alternative: Use MongoDB Time Series Collections** (5.0+):

```javascript
db.createCollection("sensor_data", {
  timeseries: {
    timeField: "ts",
    metaField: "sensorId",
    granularity: "seconds"
  }
})
```

Reference: [Building with Patterns - Bucket Pattern](https://mongodb.com/blog/post/building-with-patterns-the-bucket-pattern)
