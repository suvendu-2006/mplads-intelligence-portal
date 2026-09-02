# Stratified Human Field Audit & Label Collection Protocol

## 1. Audit Sampling Strategy (Phase 3)
To establish ground-truth empirical calibration, the system exports a **1,000-work stratified audit dataset** (`artifacts/audit_ground_truth_sample.csv`):

* **400 works** from 🔴 Field Audit Priority (Top 500 highest risk score works)
* **300 works** from 🟠 High Priority (Rank 501–1,000)
* **200 works** from ⚪ Watchlist (Behavioral & Text flags)
* **100 works** from 🟢 Clean Screen (Compliant control projects)

---

## 2. 20-Point Field Verification Checklist
Field auditor teams inspect projects against three evidence dimensions:

### A. Physical Verification
1. Physical existence of asset at declared GIS coordinates.
2. Verified physical dimensions (length, breadth, thickness).
3. Concrete core / materials quality testing.
4. Geo-tagged photographs (before, during, completion).
5. Public asset display board displaying MPLADS sanction details.

### B. Engineering & Measurement
6. Measurement Book (MB) recordings signed by Executive Engineer.
7. Bill of Quantities (BOQ) itemized rates matching CPWD DSR schedules.
8. Certificate of completion issued by Nodal District Authority.
9. Structural stability certification.
10. Handover to user department (e.g. School Headmaster, Gram Panchayat).

### C. Procurement & Financials
11. Public e-tender publication notice.
12. Minimum of 3 competitive, non-collusive bids received.
13. Contractor registration and GSTIN validity.
14. Treasury payment vouchers & bank disbursement verification.
15. Comparison against statutory e-tendering limits (₹5 Lakh).

---

## 3. Ground-Truth Classification Taxonomy
1. `CONFIRMED_FRAUD`: Official CAG finding, recovery order, proven non-existent asset, or material overbilling.
2. `SUSPICIOUS_UNCONFIRMED`: Discrepancy identified requiring forensic enquiry, but unconfirmed.
3. `CLEARED_OR_LEGITIMATE`: Verified compliant and physically existing according to DPR specifications.
