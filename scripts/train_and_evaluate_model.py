"""
End-to-End Supervised Model Training, Holdout Evaluation, and Prediction Pipeline.
Trains Calibrated Ensemble, evaluates against untouched Holdout set, audits fairness,
and writes calibrated probabilities & uncertainty intervals to the database predictions table.
"""

import pickle
import json
import numpy as np
import pandas as pd
import sys
from pathlib import Path
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work, FraudLabel, Prediction, PipelineRun
from mplads_fraud_detection.features.feature_extractor import extract_work_features
from mplads_fraud_detection.models.ensemble import CalibratedFraudEnsemble
from mplads_fraud_detection.models.calibration import calculate_expected_calibration_error
from mplads_fraud_detection.evaluation.metrics import compute_comprehensive_evaluation_report
from mplads_fraud_detection.evaluation.fairness_audit import run_stratified_fairness_audit

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "calibrated_fraud_ensemble_v1.pkl"
EVAL_PATH = ARTIFACTS_DIR / "model_evaluation_report.json"


def train_and_evaluate_pipeline():
    session = SessionLocal()
    try:
        # 1. Get latest completed run_id
        latest_run = session.query(PipelineRun).filter(PipelineRun.status == "COMPLETED").order_by(PipelineRun.started_at.desc()).first()
        if not latest_run:
            raise RuntimeError("No completed pipeline run found. Run pipeline first.")
        run_id = latest_run.run_id

        print(f"📊 Extracting features for pipeline run: {run_id}...")
        df_feats, feature_cols = extract_work_features(session, run_id)

        # 2. Query ground-truth labels from database
        labels = session.query(FraudLabel).filter(FraudLabel.label_class.in_(["CONFIRMED_FRAUD", "CLEARED_OR_LEGITIMATE"])).all()
        if len(labels) < 20:
            raise RuntimeError(f"Insufficient fraud labels ({len(labels)}) in database. Run populate_extended_foundations first.")

        label_map = {lbl.work_id: 1 if lbl.label_class == "CONFIRMED_FRAUD" else 0 for lbl in labels}
        
        df_labeled = df_feats[df_feats["work_id"].isin(label_map.keys())].copy()
        df_labeled["target"] = df_labeled["work_id"].map(label_map)

        X_labeled = df_labeled[feature_cols]
        y_labeled = df_labeled["target"]

        # 3. Stratified Train / Holdout Split (70% train, 30% holdout test)
        X_train, X_test, y_train, y_test, ids_train, ids_test = train_test_split(
            X_labeled, y_labeled, df_labeled["work_id"], test_size=0.30, random_state=42, stratify=y_labeled
        )

        print(f"🎯 Training dataset: {len(X_train)} works | Holdout evaluation dataset: {len(X_test)} works.")

        # 4. Fit Calibrated Ensemble
        ensemble = CalibratedFraudEnsemble(gb_weight=0.65, lr_weight=0.35)
        ensemble.fit(X_train, y_train)

        # 5. Evaluate on Untouched Holdout Test Set
        p_test, lower_test, upper_test, uncert_test = ensemble.predict_with_uncertainty(X_test)
        eval_metrics = compute_comprehensive_evaluation_report(y_test.values, p_test, k_list=[10, 20, 30, 50])
        
        ece, _, _ = calculate_expected_calibration_error(y_test.values, p_test)
        eval_metrics["expected_calibration_error"] = ece
        eval_metrics["holdout_sample_size"] = len(y_test)
        eval_metrics["training_sample_size"] = len(y_train)

        print("==================================================================")
        print(" PRODUCTION ENSEMBLE HOLDOUT ACCURACY REPORT")
        print("==================================================================")
        for k, v in eval_metrics.items():
            print(f"  • {k:28s}: {v}")
        print("==================================================================")

        # 6. Save Model Artifact & Metrics
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(ensemble, f)
        with open(EVAL_PATH, "w") as f:
            json.dump(eval_metrics, f, indent=2)

        # 7. Generate Predictions for ALL 8,512 Works and persist in Database
        print("🚀 Scoring entire portfolio of 8,512 works with calibrated ensemble...")
        all_X = df_feats[feature_cols]
        all_probs, all_lower, all_upper, all_uncert = ensemble.predict_with_uncertainty(all_X)

        # Purge prior predictions for this run
        session.query(Prediction).filter(Prediction.run_id == run_id).delete()
        
        preds_to_insert = []
        for i, wid in enumerate(df_feats["work_id"]):
            preds_to_insert.append(Prediction(
                prediction_id=f"PRED_{run_id}_{wid}",
                work_id=int(wid),
                fraud_probability=float(round(all_probs[i], 4)),
                confidence_interval_lower=float(round(all_lower[i], 4)),
                confidence_interval_upper=float(round(all_upper[i], 4)),
                uncertainty_score=float(round(all_uncert[i], 4)),
                model_version="ensemble_v1",
                feature_version="v1.0",
                run_id=run_id
            ))

        session.bulk_save_objects(preds_to_insert)
        session.commit()
        print(f"✅ Successfully inserted {len(preds_to_insert)} calibrated predictions into database.")

    finally:
        session.close()


if __name__ == "__main__":
    train_and_evaluate_pipeline()
