# Data Manifest & Directory Organization

## 1. Directory Structure

```
SIH-DATA/
├── data/
│   ├── raw/                  <- Raw immutable upstream government data downloads
│   ├── processed/            <- Canonical deduplicated, cleaned relational exports
│   ├── interim/              <- Intermediate calculation tables and caches
│   └── external/             <- Official external benchmarks (CPWD DSR 2023, Unit Prices)
├── artifacts/                <- Pipeline execution metrics, samples, and models
├── mplads_fraud_detection/   <- Core platform package (foundation, detectors, features, models)
├── scripts/                  <- Operational maintenance and backup scripts
├── tests/                    <- Complete test suite (unit, integration, fixtures)
└── backups/                  <- Automated compressed database archives
```

---

## 2. Core Datasets

| Dataset Path | Format | Record Count | Description |
|:---|:---:|:---:|:---|
| `data/works_completed_detailed.csv` | CSV | 15,800 | Completed infrastructure projects with item-level descriptions and dates |
| `data/works_recommended.csv` | CSV | 2,390 | Recommended projects with budget estimates |
| `data/all_mps_financial_breakdown.csv` | CSV | 774 | MP-level entitlement, expenditure, and utilization accounts |
| `data/expenditures.csv` | CSV | 29,000 | Itemized financial disbursement vouchers (2023–2026) |
| `data/cpwd_benchmark_rates.csv` | CSV | 15 | Central Public Works Department DSR 2023 standard item rates |
| `data/unit_prices_master.csv` | CSV | 30 | Physical engineering feasibility ranges and impossibility bounds |
