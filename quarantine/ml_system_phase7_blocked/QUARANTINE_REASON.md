# ML System Quarantine

**Reason**: Current ML implementation violates production requirements:
1. Uses synthetic data generation (removed)
2. Random train/test split (not time-based)
3. Detector outputs as features (circular logic)
4. Fake confidence intervals (random noise)

**Release Criteria**:
- [ ] 300+ dual-reviewed, verified labels collected
- [ ] Time-based train/test split implemented
- [ ] Features engineered without detector outputs
- [ ] Proper conformal prediction intervals
- [ ] ECE ≤ 0.05 on holdout set
- [ ] Independent validation completed

**Status**: 0 verified labels → ML BLOCKED
