# MPLADS Data Provenance & Lineage Specification

## 1. Raw Source Ground-Truth Verification

| Source File | Raw File Size | Total Rows | Date Range | Primary Key Field | Status |
|:---|:---:|:---:|:---:|:---:|:---:|
| `data/works_completed_detailed.csv` | 6.88 MB | 15,800 | 2024–2026 | `work_id` (7,268 distinct) | Completed Works |
| `data/works_recommended.csv` | 1.13 MB | 2,390 | 2024–2026 | `workId` (1,244 distinct) | Recommended Works |
| `data/all_mps_financial_breakdown.csv` | 148 KB | 774 | Aug 31, 2026 | `mp_id` | MP Portfolio Accounts |
| `data/expenditures.csv` | 5.44 MB | 29,000 | 2023–2026 | `_id` | Financial Transactions |
| `data/cpwd_benchmark_rates.csv` | 1.2 KB | 15 | 2023 | `category + unit` | CPWD DSR 2023 Baseline |
| `data/unit_prices_master.csv` | 3.5 KB | 30 | 2024 | `item_id` | Engineering Bounds |

---

## 2. Deduplication and Harmonization Contract

### Resolution of 8,512 Unified Works
* **Completed Works Detailed (`works_completed_detailed.csv`)**: Contains **15,800 raw rows**. Grouping by `work_id` yields exactly **7,268 distinct completed projects** (the remaining rows represent sub-task lines and duplicated reporting lines).
* **Recommended Works (`works_recommended.csv`)**: Contains **2,390 raw rows**. Deduplicating on `workId` with `keep='first'` yields **1,244 distinct recommended projects** (1,146 exact duplicate rows eliminated).
* **Cross-File Overlap Resolution**: 5 work IDs exist in both files. The canonical ETL applies completed status precedence.
* **Final Single-Source-of-Truth Count**:
  $$\mathbf{7,268} \text{ (Completed)} + \mathbf{1,244} \text{ (Recommended)} = \mathbf{8,512} \text{ Unique Audited Projects}$$

---

## 3. Data Integrity Guarantee
* **Primary Key Uniqueness**: `works.work_id` is guaranteed 100% unique.
* **Positive Cost Constraint**: All projects have verified cost $> ₹0$.
* **Strict Idempotency**: Running ETL and detectors with identical snapshot run keys produces identical, zero-drift results.
