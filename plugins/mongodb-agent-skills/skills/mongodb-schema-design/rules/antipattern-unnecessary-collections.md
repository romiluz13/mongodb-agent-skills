---
title: Reduce Unnecessary Collections
impact: HIGH
impactDescription: Eliminates joins, reduces round trips
tags: schema, collections, anti-pattern, embedding, normalization, atlas-suggestion
---

## Reduce Unnecessary Collections

Too many collections indicate over-normalization. Each additional collection requires a separate query or $lookup, adding latency and complexity. Embed when data is accessed together.

**Incorrect (SQL-style normalization):**

```javascript
// 5 collections for one order
// orders: { _id, customerId, date, status }
// order_items: { orderId, productId, quantity, price }
// products: { _id, name, sku }
// customers: { _id, name, email }
// addresses: { customerId, street, city }

// Displaying one order requires 5 queries or complex $lookup
db.orders.aggregate([
  { $match: { _id: orderId } },
  { $lookup: { from: "order_items", ... } },
  { $lookup: { from: "products", ... } },
  { $lookup: { from: "customers", ... } },
  { $lookup: { from: "addresses", ... } }
])
```

**Correct (embedded document model):**

```javascript
// Single document contains everything needed
{
  _id: "order123",
  date: ISODate("2024-01-15"),
  status: "shipped",
  customer: {
    name: "Alice Smith",
    email: "alice@example.com"
  },
  shippingAddress: {
    street: "123 Main St",
    city: "Boston"
  },
  items: [
    { sku: "LAPTOP-01", name: "Laptop", quantity: 1, price: 999 },
    { sku: "MOUSE-02", name: "Mouse", quantity: 2, price: 29 }
  ],
  total: 1057
}

// One query returns complete order
db.orders.findOne({ _id: "order123" })
```

**When to use separate collections:**
- Data changes independently at different rates
- Data is accessed separately most of the time
- Arrays would grow unbounded
- Document would exceed 16MB

Atlas Schema Suggestions flags this as: "Reduce number of collections".

Reference: [Embedding vs Referencing](https://mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
