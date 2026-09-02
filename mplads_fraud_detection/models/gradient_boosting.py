"""
Gradient Boosted Tabular Fraud Risk Classifier.
Uses HistGradientBoostingClassifier for robust non-linear feature interaction modeling.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from typing import Dict, Any


def train_gradient_boosting_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    random_state: int = 42
) -> HistGradientBoostingClassifier:
    """
    Trains a high-performance Gradient Boosted Decision Tree model for tabular fraud-risk scoring.
    """
    model = HistGradientBoostingClassifier(
        max_iter=150,
        learning_rate=0.05,
        max_depth=6,
        min_samples_leaf=20,
        l2_regularization=1.0,
        early_stopping=True,
        random_state=random_state
    )
    model.fit(X_train, y_train)
    return model
