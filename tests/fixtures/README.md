# Test Fixtures Library

This directory contains deterministic test fixtures for unit and integration testing of the MPLADS Fraud-Risk Screening & Auditing Platform:

1. **`synthetic_10_works.csv`**: 10 clean, standard municipal infrastructure projects adhering strictly to CPWD norms and realistic timelines.
2. **`synthetic_fraud_cases.csv`**: 5 ground-truth fraud patterns including CPWD unit cost overruns, ghost projects, bill-splitting smurfing, and copy-paste pricing.
3. **`synthetic_edge_cases.csv`**: Boundary and invalid cases (zero costs, empty descriptions, extreme outliers, negative amounts, temporal inversions) to test validation robustness.
