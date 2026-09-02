# Governance, Legal & Ethics Review Charter

## 1. Statutory Mandate & Authority
The MPLADS Fraud-Risk Screening & Auditing Platform operates under the statutory oversight of:
* Ministry of Statistics and Programme Implementation (MoSPI)
* Comptroller and Auditor General of India (CAG) Guidelines on MPLADS Scheme
* State Vigilance & Enforcement Directorates

---

## 2. Review Board Composition
1. **Chief Data Protection Officer (CDPO)**: Verifies citizen privacy, PII redaction, and hash security.
2. **Principal Forensic Auditor (CAG/Vigilance)**: Validates engineering plausibility bounds and CPWD DSR rate conformity.
3. **Legal Counsel**: Ensures constitutional protections under Article 14 and administrative non-arbitrariness.
4. **Ethics & AI Fairness Officer**: Verifies compliance with the Ethical Exclusion Policy ([`ETHICS.md`](file:///Users/suvendu/Downloads/SIH-DATA/ETHICS.md)) barring political or personal attributes.

---

## 3. Deployment Sign-Off Thresholds
* **Zero Disparate Impact**: $\text{FPR}_{\text{district}} \le 2.0 \times \text{FPR}_{\text{national}}$.
* **Expected Calibration Error (ECE)**: $\text{ECE} < 0.05$.
* **Auditor Discretion Guarantee**: All algorithmic outputs serve as decision-support alerts, never automated sanctions.
