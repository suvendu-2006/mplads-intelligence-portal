"""
Baseline Supervised Regularized Logistic Regression Model for Fraud Risk Prediction.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegressionCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from typing import Tuple, Dict, Any


def train_baseline_model(X_train: pd.DataFrame, y_train: pd.Series) -> Pipeline:
    """
    Trains an L2-regularized Logistic Regression baseline with 5-fold cross-validation.
    """
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegressionCV(
            Cs=10,
            cv=5,
            penalty="l2",
            scoring="roc_auc",
            random_state=42,
            max_iter=1000
        ))
    ])
    pipeline.fit(X_train, y_train)
    return pipeline
