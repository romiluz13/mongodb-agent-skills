---
title: Use Extended Reference Pattern
impact: MEDIUM
impactDescription: Eliminates frequent $lookup while maintaining data integrity
tags: schema, patterns, extended-reference, denormalization, caching
---

## Use Extended Reference Pattern

Copy frequently-accessed fields from referenced documents into the parent. Eliminates $lookup for common queries while keeping the full data normalized.

**Incorrect (always $lookup for display data):**

```javascript
// Order references customer by ID only
{
  _id: "order123",
  customerId: "cust456", // Just an ID
  items: [...],
  total: 299.99
}

// Every order display requires $lookup
db.orders.aggregate([
  { $match: { _id: "order123" } },
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer"
  }}
])
```

**Correct (extended reference):**

```javascript
// Order contains frequently-needed customer fields
{
  _id: "order123",
  customer: {
    _id: "cust456",         // Reference for full lookup when needed
    name: "Alice Smith",    // Cached for display
    email: "alice@ex.com"   // Cached for notifications
  },
  items: [...],
  total: 299.99
}

// Display order without $lookup
db.orders.findOne({ _id: "order123" })

// Full customer data still available when needed
db.customers.findOne({ _id: order.customer._id })
```

**When customer data changes:**

```javascript
// Update name in both places
// 1. Update source of truth
db.customers.updateOne(
  { _id: "cust456" },
  { $set: { name: "Alice Johnson" } }
)

// 2. Update cached copies (can be async/eventual)
db.orders.updateMany(
  { "customer._id": "cust456" },
  { $set: { "customer.name": "Alice Johnson" } }
)
```

**What to cache:**

- Fields displayed in lists (name, avatar, title)
- Fields used for sorting/filtering
- Slowly-changing data (name vs real-time balance)

**What NOT to cache:**

- Frequently-changing data (balance, inventory)
- Sensitive data in non-sensitive collections
- Large fields (bio, description)

Reference: [Building with Patterns - Extended Reference](https://mongodb.com/blog/post/building-with-patterns-the-extended-reference-pattern)
