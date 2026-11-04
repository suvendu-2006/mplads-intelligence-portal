# Archive & Quarantined Artifacts

This directory stores archived prototypes, legacy implementations, and quarantined components that are strictly isolated from the production codebase and runtime environments.

## Quarantined ML Prototype (`archive/quarantine/`)

The machine learning prototype modules previously residing in `scripts/train_and_evaluate_model.py` and `mplads_fraud_detection/models/ensemble.py` have been moved to `archive/quarantine/ml_system_phase7_blocked/`.

### Rationale for Quarantine

The initial prototype violated rigorous anti-fraud statistical standards and operational production safety:
1. **Synthetic Contamination**: Relying on synthetic data generation rather than audited administrative records.
2. **Circular Feature Dependencies**: Using detector outputs as model features (data leakage).
3. **Invalid Partitioning**: Utilizing random train/test splits instead of temporally separated, leak-free splits.
4. **Uncalibrated Uncertainty**: Generating ungrounded pseudo-confidence intervals instead of rigorous conformal prediction intervals.

### Production Re-Admission Prerequisites

Per project governance standards and Acceptance Gate 15 (`tests/acceptance_tests.sh`), the ML model remains strictly blocked from production deployment until all of the following criteria are met:
- [ ] Minimum **300+ dual-reviewed, verified audit labels** collected via the operational review queue workflow.
- [ ] Strict **time-based temporal train/test split** implemented to prevent lookahead leakage.
- [ ] Model features engineered independently without detector circular outputs.
- [ ] Proper conformal prediction intervals validated for uncertainty quantification.
- [ ] Expected Calibration Error (ECE) $\le 0.05$ on an independent holdout set.
- [ ] Formal independent validation completed and approved.
