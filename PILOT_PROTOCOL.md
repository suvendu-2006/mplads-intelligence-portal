# Silent Pilot Deployment & A/B Testing Protocol (Phase 7)

## 1. Pilot Architecture (Silent Shadow Mode)
The 12-week silent pilot deploys the trained `CalibratedFraudEnsemble` in **shadow scoring mode**:
* **Shadow Scoring**: Predictions are generated and logged to the `predictions` table in real time as new projects are sanctioned.
* **Blinded Review**: Field inspection teams evaluate assigned cases without visibility into whether a project was selected by the model or random control.

---

## 2. A/B Randomized Stratification Plan
* **Group A (Treatment / Model-Selected)**: Top 500 highest predicted fraud-risk works ($\text{fraud\_probability} \ge 0.70$).
* **Group B (Control / Random Baseline)**: 500 randomly selected works from the active municipal project registry.

---

## 3. Success Metrics & Phase Exit Criteria
1. **Confirmation Multiplier**: Group A verified fraud confirmation rate must exceed **$2.0\times$ Group B**.
2. **Precision@100 Target**: Field verification confirmation $\ge 60\%$ in the top 100 cases.
3. **Fairness Gate**: No geographic region or category exhibits $\text{FPR} > 2.0\times$ national baseline.
