# Cross-Skill Quality Metrics

## Inventory

From `data/rule_inventory.csv`:

- Schema: 30
- Query/Index: 46
- AI: 33
- Total: 109

## Structural Section Coverage

From `data/rule_structure_metrics.csv`:

| Skill | Total | Incorrect | Correct | When NOT to use | Verify with |
|---|---:|---:|---:|---:|---:|
| Schema | 30 | 28 | 30 | 28 | 30 |
| Query/Index | 46 | 43 | 43 | 29 | 38 |
| AI | 33 | 33 | 33 | 33 | 0 |

## Category Distribution

From `data/rule_prefix_distribution.csv`:

- Schema prefixes: `pattern`(10), `relationship`(6), `antipattern`(6), `fundamental`(5), `validation`(3)
- Query/Index prefixes: `index`(20), `query`(10), `agg`(8), `perf`(8)
- AI prefixes: `index`(9), `query`(7), `perf`(6), `rag`(4), `hybrid`(4), `agent`(3)

## Interpretation

- Coverage breadth is high across all three skills.
- The main weakness is **consistency depth** (especially verification sections and factual synchronization).
