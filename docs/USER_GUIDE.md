# MPLADS Audit Triage System — Official User Guide

## 1. Quick Start (30 Minutes)

### Step 1: Secure Authentication
1. Navigate to your deployed instance URL (e.g. `https://mplads-fraud.gov.in` or `http://localhost:8501`).
2. Enter your assigned governmental credentials and select **Sign In**.
3. Default credentials for local development: username `admin` / password `ChangeMe123!`.

### Step 2: Interpreting the Executive Overview
- **Total Works Audited**: Canonical total projects monitored across the state/portfolio.
- **Works Flagged**: Works exhibiting one or more rule-based risk indicators.
- **Flagged Rate**: Proportion of portfolio requiring forensic prioritization (typically 15%–30%).

> [!IMPORTANT]
> **Core Operating Principle**: A "Flagged Work" represents an **Evidence Signal requiring field verification**, NOT an accusation of fraud.

---

## 2. Forensic Evidence Signals Explained

Each work may trigger signals across 15 automated forensic detectors:

| Signal Type | Regulatory / Engineering Standard | Required Investigative Action |
|:---|:---|:---|
| **Cost Overrun (D3)** | Exceeds official CPWD DSR 2023 schedule by $>40\%$ | Inspect Bill of Quantities (BOQ) and measurement sheets |
| **Duplicate Scope (D2)** | High semantic text similarity ($>0.85$) with concurrent works | Cross-check site GPS coordinates and tender award numbers |
| **Delay Violation (D6)** | Work duration exceeds the statutory 365-day execution norm | Check for approved extension orders from District Collector |
| **Fiscal Timing (D7)** | Completion clustered in March 25–31 rush | Verify physical quality and inspection before payment release |
| **Plausibility (D11)** | Cost violates physical engineering minimum/maximum bounds | Verify unit quantities (e.g. ₹45K school or ₹28L handpump) |

---

## 3. Role-Based Access Control (RBAC) Matrix

| User Role | Permissions & Functional Access |
|:---|:---|
| **Viewer** | Read-only access to Executive Overview and Anomaly Explorer |
| **Analyst** | Viewer access + filter drill-down, review queue inspection, and drafting review notes |
| **Auditor** | Analyst access + access to Stratified Field Audit Queue and submission of field inspection reports |
| **Senior Reviewer** | Auditor access + final adjudication, approval, or dispute of human audit labels |
| **Admin** | Full platform access, pipeline execution, user account provisioning, and audit logs |

---

## 4. Glossary of Standardized Terminology

- **Anomaly**: A statistical or rule-based deviation detected by an algorithmic detector. Not a legal accusation.
- **Evidence Signal**: An objective forensic indicator requiring human documentary or physical verification.
- **Questioned Expenditure**: The total sanctioned value of a project under review, pending audit confirmation.
- **Audit Queue**: A risk-stratified cohort of projects prioritized for field verification by audit teams.
- **Verified Label**: An empirical ground-truth outcome confirmed by a certified auditor (`CONFIRMED_FRAUD`, `CLEARED_OR_LEGITIMATE`, `SUSPICIOUS_UNCONFIRMED`).

---

## 5. Standard Operating Procedures

### Task A: Exporting the 1,000-Work Stratified Audit Sample
1. Log in with an **Auditor** or **Admin** account.
2. Select the **📋 Field Audit & Ground Truth Desk** tab.
3. Click **📥 Download Official 1,000-Work Audit Sample (CSV)**.
4. Distribute the generated CSV to regional inspection teams.

### Task B: Recording a Verified Field Inspection Finding
1. Select the inspected **Work ID** from the inspection queue dropdown.
2. Select the official inspection outcome:
   - `CONFIRMED_FRAUD`: Physical non-existence, inadmissible work, or proven overbilling.
   - `CLEARED_OR_LEGITIMATE`: Inspected, compliant with DPR, and physically verified.
   - `SUSPICIOUS_UNCONFIRMED`: Discrepancy observed; enquiry pending.
3. Enter your Officer ID / Designation and detailed inspection notes.
4. Click **💾 Commit Verified Ground-Truth Label**.
