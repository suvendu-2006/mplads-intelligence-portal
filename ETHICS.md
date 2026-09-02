# Ethical Compliance, Fairness & Non-Discrimination Policy

## 1. Core Principles
The MPLADS Fraud-Risk Screening & Auditing Platform strictly adheres to evidence-based forensic engineering and objective procurement standards. It is designed to assist independent human auditors, not to make automated legal accusations.

---

## 2. Prohibited Predictive Attributes
Under no circumstances may machine learning models or rule engines incorporate demographic, political, or personal attributes as predictive features:

* 🚫 **Political Affiliation**: MP party, political alliance, election margins, vote shares.
* 🚫 **Personal Demographics**: MP wealth, declared assets, religion, caste, gender, age, education.
* 🚫 **Electoral Geography**: Voter demographics or political constituency classifications.

These attributes are strictly quarantined and barred from model training via [`mplads_fraud_detection/features/excluded_attributes.py`](file:///Users/suvendu/Downloads/SIH-DATA/mplads_fraud_detection/features/excluded_attributes.py).

---

## 3. Disparate Impact Auditing
Before model deployment or recalibration, a **Stratified Fairness Audit** ([`fairness_audit.py`](file:///Users/suvendu/Downloads/SIH-DATA/mplads_fraud_detection/evaluation/fairness_audit.py)) must verify that False Positive Rates (FPR) across all regions, categories, and value bands do not exceed $2.0\times$ the national baseline.
