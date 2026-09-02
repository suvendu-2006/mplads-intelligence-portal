"""
Ethical Exclusion Policy and Fairness Controls for MPLADS Fraud-Risk Modeling.
Strictly excludes demographic, political, and sensitive personal attributes from model features.
"""

EXCLUDED_PREDICTIVE_ATTRIBUTES = {
    # Political Attributes
    "mp_party",
    "mp_alliance",
    "party_vote_share",
    "ruling_party_flag",

    # Demographics & Personal Attributes
    "mp_wealth",
    "mp_assets_declared",
    "mp_caste",
    "mp_religion",
    "mp_gender",
    "mp_age",
    "mp_education",
    "mp_criminal_cases",
    "demographic_profile"
}


def validate_feature_ethics(feature_names: list) -> bool:
    """
    Validates that no sensitive political or personal demographic attributes are present
    in the predictive feature set.
    """
    violations = [f for f in feature_names if f in EXCLUDED_PREDICTIVE_ATTRIBUTES]
    if violations:
        raise ValueError(
            f"ETHICAL COMPLIANCE VIOLATION: Predictive model input contains prohibited attributes: {violations}. "
            "Sensitive demographic/political attributes must never be used for fraud risk scoring."
        )
    return True
