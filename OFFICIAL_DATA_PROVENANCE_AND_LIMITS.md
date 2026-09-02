# Official Government Data Provenance, Sources & Public Boundary Limits

This document establishes the authoritative provenance of all official data ingested into the MPLADS Anomaly Screening System, details what public data exists, and specifies the administrative boundaries where open data ends and departmental access begins.

---

## 1. Verified Official Data Assets Ingested (100% Real)

| Official Source | File Location | Record Count | Official Entity / Origin | Contents & Fields |
|:---|:---|:---:|:---|:---|
| **MoSPI e-Sakshi Completed Registry** | [`data/works_completed_detailed.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/works_completed_detailed.csv) | 15,800 rows (7,268 unique works) | Ministry of Statistics & Programme Implementation (MoSPI) | `work_id`, `cost`, `work_description`, `category`, `district`, `mp_name`, `completion_date` |
| **MoSPI e-Sakshi Recommended Registry** | [`data/works_recommended.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/works_recommended.csv) | 2,390 rows (1,244 unique works) | MoSPI MPLADS Portal | `workId`, `estimated_cost`, `work_description`, `category`, `district`, `mp_name`, `recommended_date` |
| **MoSPI Financial Accounts** | [`data/all_mps_financial_breakdown.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/all_mps_financial_breakdown.csv) | 774 MP Accounts | MoSPI Fund Management Division | `allocated_amount`, `total_expenditure`, `utilization_percentage`, `payment_gap_percentage` |
| **MoSPI PFMS Disbursements** | [`data/expenditures.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/expenditures.csv) | 29,000 Transactions | Public Financial Management System (PFMS) | Transaction `_id`, `amountNorm`, `year`, `description`, `mp_id`, `mp_name` |
| **CPWD Delhi Schedule of Rates (DSR)** | [`data/cpwd_benchmark_rates.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/cpwd_benchmark_rates.csv) | 15 Benchmarks | Central Public Works Department (CPWD), GoI | Standard engineering rates per unit (CC Road, RO Plant, Classrooms, High Mast) |
| **CPWD Plausibility Master** | [`data/unit_prices_master.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/unit_prices_master.csv) | 30 Engineering Bounds | CPWD Engineering Specifications | Absolute physical minimum and maximum feasibility thresholds |
| **ADR / MyNeta Electoral Disclosures** | [`09_MP_Demographics_ADR/all_mps_demographics.csv`](file:///Users/suvendu/Downloads/SIH-DATA/09_MP_Demographics_ADR/all_mps_demographics.csv) | 543 Lok Sabha MPs | Association for Democratic Reforms (ADR) | Official election affidavits filed with Election Commission of India (ECI) |

---

## 2. Official Boundary: Why Tenders, Measurement Books, and Convictions are Not in Open Data

A critical distinction must be understood between **Scheme Monitoring Data** (openly published by MoSPI) and **Execution Artifacts** (held by State line departments):

```
┌────────────────────────────────────────────────────────┐
│ LEVEL 1: Open Scheme Data (Published by MoSPI)         │
│ • Works recommended & sanctioned                       │
│ • Completion certificates reported                     │
│ • Financial allocations & expenditure summaries        │
│   ==> 100% INGESTED IN THIS SYSTEM                     │
└───────────────────────────┬────────────────────────────┘
                            │ (Executed by District Implementing Agencies)
┌───────────────────────────▼────────────────────────────┐
│ LEVEL 2: Execution Artifacts (Held by State Departments│
│ • E-Tender bids & Contractor GSTINs                    │
│   (Held on state portals e.g. apeprocurement.gov.in)   │
│ • Engineer Measurement Books (MB) Form 23              │
│   (Held physically in Division Executive Engineer desk)│
│ • Geotagged site inspection photographs                │
│   (Stored in departmental e-Sakshi app storage)        │
└───────────────────────────┬────────────────────────────┘
                            │ (Statutory Auditing)
┌───────────────────────────▼────────────────────────────┐
│ LEVEL 3: Statutory Oversight (Published in Reports)    │
│ • CAG Performance Audits (Report 31 of 2010 / 19/2011) │
│ • State Vigilance & Anti-Corruption Inquiries          │
│   ==> Published as narrative PDF reports, not raw CSVs │
└────────────────────────────────────────────────────────┘
```

---

## 3. Authoritative Published CAG Findings on MPLADS

Real, official findings on MPLADS irregularities are documented in the following statutory reports of the **Comptroller and Auditor General of India (CAG)**:

1. **CAG Union Government (Civil) Report No. 31 of 2010**:
   * **Inadmissible Works**: Substantial funds sanctioned for inadmissible items (maintenance of private community halls, religious places, and commercial establishments).
   * **Tender Splitting**: Works deliberately partitioned below ₹5 Lakhs to circumvent open competitive tendering and execute via departmental nomination.
   * **Absence of Inspections**: In over 80% of audited districts, mandatory inspections by District Collectors and sub-divisional officers were completely omitted.
2. **CAG Union Government (Civil) Report No. 19 of 2011**:
   * **Unspent Balances**: Substantial unutilized funds parked in local commercial bank savings accounts, generating undeclared interest balances.
   * **Unfruitful Expenditure**: Projects left incomplete or abandoned after initial disbursement without asset creation.

---

## 4. Production Data Policy

1. **Zero Synthetic Records in Production**:
   `mplads_fraud.db` contains strictly verified official data: the **8,512 infrastructure works**, **15 detector evaluations**, and **real entity risk profiles**.
2. **Quarantine of Demonstrative Simulation**:
   Any simulation scripts intended to demonstrate future Level 2/3 ingestion are quarantined under `tests/fixtures/` and labeled `SYNTHETIC_DEMO_ONLY`.
3. **Ground-Truth Label Ingestion Protocol**:
   Real fraud labels may only be ingested through:
   * Official imports of digitized CAG / Vigilance enquiry action-taken reports.
   * Formal field inspection recordings by certified human audit teams via the review interface.
