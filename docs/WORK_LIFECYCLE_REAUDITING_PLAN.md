# Architecture Plan & Technical Blueprint: Real-Time Work Lifecycle Anomaly Re-Auditing Engine v3.0-Production-Hardened

**Document:** `docs/WORK_LIFECYCLE_REAUDITING_PLAN.md`  
**Classification:** Sovereign Forensic Audit Engineering Specification  
**Canonical Baseline:** Commit `fabaf03` (Nov 6, 2026) • MoSPI National Corpus ₹45,116,074,156.14  
**Target Environment:** Project SATARK • MPLADS Surveillance Platform (FastAPI / SQLite WAL / PostgreSQL TLS)  

---

## 1. Executive Summary & Architecture Foundation

### 1.1 Scope & Problem Statement
SATARK currently executes anomaly detection as a **monolithic batch-snapshot process** (`run_full_pipeline` in `mplads_fraud_detection/pipeline.py`), which fits models and evaluates detectors over the entire dataset of 8,512 canonical works. 

This technical blueprint transitions SATARK to a **hybrid stream/batch architecture**:
1. **Real-Time Event Auditing**: Individual work updates (`PATCH /api/works/{id}`) and MP recommendations (`POST /api/mps/{id}/recommend-work`) trigger instant in-memory evaluation (<25ms) across 11 work-level detectors (D1–D8, D10–D12, D15).
2. **Selective Batch Re-Auditing**: ETL sync (`etl.py`) inspects field diffs and only re-audits mutated records.
3. **In-Place Soft Resolution**: Clearing a red flag updates `is_active = False` on the composite key `(work_id, detector_type, run_id)`, preserving forensic audit history while preventing `uq_work_detector_run` collision crashes.
4. **Dual-Mode Security Gate**: High-assurance stateless RFC 9110 Bearer JWT (HS256 via Python standard library) coupled with multi-district authorization (`assigned_districts`), with 100% backward-compatible fallback to `webapi/auth_demo.py`.
5. **Zero-Regression Guarantee**: 100% compliance with all 16 acceptance gates in `tests/acceptance_tests.sh`, including Gate 15 ML quarantine, Gate 7/16 Alembic idempotency and PostgreSQL TLS DDL, and `test_data_contract.py`.

---

## 2. Core Architectural Invariants & Constraints

### 2.1 Invariant 1: Canonical MoSPI Data Contract
- As of commit `fabaf03` (Nov 6, 2026), official MoSPI expenditure in `data/01_Overview_and_National_Summary/national_overview.csv` is **₹45,116,074,156.14** (₹4,511.61 Crore).
- All components, documentation, test assertions, and metrics must use **dynamic CSV lookup** via `webapi.data_service.load_national_csv()` or reference `₹45,116,074,156.14`. No stale historical figures (e.g., ₹39,600 Cr or ₹14,700 Cr) shall be hardcoded in new code or assertions.

### 2.2 Invariant 2: Gate 15 ML Quarantine Protection
- Gate 15 of `tests/acceptance_tests.sh` asserts:
  1. `scripts/train_and_evaluate_model.py` and `mplads_fraud_detection/models/ensemble.py` remain quarantined/absent.
  2. `scripts/train_model.py` exists, exits with return code 1, and prints `'gated until 300+ verified labels'`.
- **Constraint:** Real-time re-auditing for D1 (Isolation Forest) uses **unsupervised statistical parameter export** (`scripts/export_detector_models.py` -> `detector_01_isolation_forest.joblib` and `detector_01_medians.json`). Under no circumstances will `scripts/train_model.py` be modified or supervised model training code introduced.

### 2.3 Invariant 3: Unique Constraint `uq_work_detector_run` & In-Place Soft Resolution
- Table `anomalies` enforces `UniqueConstraint("work_id", "detector_type", "run_id", name="uq_work_detector_run")`.
- When real-time re-auditing evaluates a work against `run_key='realtime_lifecycle_stream'`:
  - **Re-Flagging / Severity Update**: If an anomaly row exists for `(work_id, detector_type, stream_run_id)`, perform an **in-place update**:
    ```python
    existing.is_active = True
    existing.severity = new_severity
    existing.explanation = new_explanation
    existing.evidence = new_evidence
    existing.resolved_at = None
    existing.resolution_reason = None
    existing.detected_at = datetime.now(timezone.utc)
    ```
  - **Resolution / Clearance**: If a detector finding is cleared or drops below statutory floor:
    ```python
    existing.is_active = False
    existing.resolved_at = datetime.now(timezone.utc)
    existing.resolution_reason = "Condition cleared by lifecycle re-audit: [reason]"
    ```
  - **New Finding**: If no row exists and `severity >= 0.50`, insert new `Anomaly` with `is_active=True`.
  - **Crash Prevention**: Never attempt a raw `session.add(Anomaly(...))` without querying existing `(work_id, detector_type, stream_run_id)` first.

### 2.4 Invariant 4: Statutory Severity Floor ($\ge 0.50$)
- Table `anomalies` enforces `CheckConstraint("severity >= 0.50 AND severity <= 1.00", name="chk_valid_anomaly_severity")`.
- If an evaluation produces a score $< 0.50$:
  - Transition any existing active anomaly to `is_active = False`, `resolved_at = now()`, `resolution_reason = "Severity dropped below statutory floor (0.50)"`.
  - Never insert a new row with severity $< 0.50$.

### 2.5 Invariant 5: Zero-Dependency Standard Library JWT
- `webapi/security.py` must use Python's built-in `hmac`, `hashlib`, `base64`, `json`, and `time` for stateless HS256 tokens.
- No external pip dependencies (`PyJWT`, `python-jose`, `authlib`) are permitted, preserving reproducible lockfile builds (`requirements.lock`).

### 2.6 Invariant 6: Migration Idempotency & SQLite Batch Alteration
- SQLite WAL does not support native `ALTER TABLE DROP COLUMN` or complex constraint alterations.
- All migration operations in Alembic must use:
  ```python
  with op.batch_alter_table("works", schema=None) as batch_op:
      ...
  with op.batch_alter_table("anomalies", schema=None) as batch_op:
      ...
  ```
- All migration code must pass `tests/test_postgres_tls_staging.py` (offline SQL generation) and Gate 7 (`upgrade head` -> `downgrade base` -> `upgrade head`).

### 2.7 Invariant 7: Nested Savepoint Isolation (`begin_nested()`)
- In `WorkLifecycleAuditor`: each of the 11 detector evaluations must be wrapped in `with session.begin_nested():`.
- If a detector raises an exception:
  1. The savepoint rolls back only that detector's modifications.
  2. The exception is logged.
  3. The detector is added to `failed_detectors`.
  4. Subsequent detectors continue evaluation.
  5. If `failed_detectors` is non-empty, the work is marked `audit_status = "PARTIALLY_AUDITED"`. If all pass, `audit_status = "AUDITED"`.

---

## 3. Sequenced Phased Implementation Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Database Schema Migrations & Model Serialization                  │
│ • Alembic migration: works & anomalies column extensions (batch mode)       │
│ • ORM schema synchronization in schema.py                                  │
│ • Permanent singleton run: run_key='realtime_lifecycle_stream'              │
│ • Model serialization: Isolation Forest & benchmark medians                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Core WorkLifecycleAuditor Engine                                    │
│ • WorkLifecycleAuditor class with nested savepoint isolation               │
│ • Direct in-memory instance evaluation for D1-D8, D10-D12, D15              │
│ • Cascading D2 candidate window & severity floor clipping (>= 0.50)         │
│ • In-place soft-resolution upserts on uq_work_detector_run                 │
│ • Cold-start ML degradation fallback                                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: REST API Endpoints & Dual-Mode Security Gate                       │
│ • Dual-mode security: RFC 9110 Bearer HMAC-SHA256 JWT + auth_demo fallback │
│ • Multi-district scoping (assigned_districts) & role authorization         │
│ • PATCH /api/works/{id} & deprecated POST /api/works/{id}/update            │
│ • Unified multi-router cache invalidation                                   │
│ • Wire POST /api/mps/{id}/recommend-work to real-time auditor               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Batch ETL Synchronization & 12 Automated Verification Scenarios   │
│ • Upgrade load_works_into_db() with field diff detection                    │
│ • Author tests/test_lifecycle_re_auditing.py covering all 12 test gates     │
│ • Verify zero regressions (16/16 gates in acceptance_tests.sh & pytest)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Database Schema Migrations & Model Serialization

#### Step 1.1: Alembic Migration & ORM Schema Alignment
- **Objective:** Add lifecycle columns and composite indexes to `works` and `anomalies` tables via a clean, fully reversible Alembic migration compatible with SQLite batch mode and PostgreSQL dialects, and update canonical SQLAlchemy models.
- **Files to Modify:**
  - `mplads_fraud_detection/foundation/schema.py`:
    - Extend `Work`:
      ```python
      updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)
      last_audited_at = Column(DateTime, nullable=True)
      lifecycle_audit_version = Column(String(50), default="v3.0", nullable=True)
      audit_status = Column(String(30), default="PENDING", nullable=True)
      ```
      Add to `__table_args__`:
      ```python
      Index("idx_works_district_rec_date", "district", "recommended_date"),
      ```
    - Extend `Anomaly`:
      ```python
      is_active = Column(Boolean, default=True, server_default="1", nullable=False, index=True)
      resolved_at = Column(DateTime, nullable=True)
      resolution_reason = Column(Text, nullable=True)
      ```
      Add to `__table_args__`:
      ```python
      Index("idx_anomalies_work_active_detector", "work_id", "is_active", "detector_type"),
      ```
- **Files to Create:**
  - `migrations/versions/<rev_id>_realtime_lifecycle_reauditing.py`:
    - Reads current head via `alembic heads`.
    - Implements `upgrade()`:
      ```python
      with op.batch_alter_table("works", schema=None) as batch_op:
          batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))
          batch_op.add_column(sa.Column("last_audited_at", sa.DateTime(), nullable=True))
          batch_op.add_column(sa.Column("lifecycle_audit_version", sa.String(50), server_default="v3.0", nullable=True))
          batch_op.add_column(sa.Column("audit_status", sa.String(30), server_default="PENDING", nullable=True))
          batch_op.create_index("idx_works_district_rec_date", ["district", "recommended_date"])

      with op.batch_alter_table("anomalies", schema=None) as batch_op:
          batch_op.add_column(sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False))
          batch_op.add_column(sa.Column("resolved_at", sa.DateTime(), nullable=True))
          batch_op.add_column(sa.Column("resolution_reason", sa.Text(), nullable=True))
          batch_op.create_index("idx_anomalies_work_active_detector", ["work_id", "is_active", "detector_type"])
      ```
    - Implements reversible `downgrade()` dropping indexes and columns in reverse order.
- **Verification Commands:**
  - `alembic upgrade head`
  - `pytest -v tests/test_postgres_tls_staging.py`
  - Gate 7 idempotency test:
    ```bash
    DATABASE_URL=sqlite:///test_mig.db alembic upgrade head
    DATABASE_URL=sqlite:///test_mig.db alembic downgrade base
    DATABASE_URL=sqlite:///test_mig.db alembic upgrade head
    rm -f test_mig.db
    ```

#### Step 1.2: Permanent Singleton Stream Pipeline Run Seeding
- **Objective:** Establish an idempotent initialization routine ensuring a permanent singleton `PipelineRun` record with `run_key='realtime_lifecycle_stream'` exists in `pipeline_runs`, fully isolated from batch snapshot purges.
- **Files to Modify:**
  - `mplads_fraud_detection/foundation/db.py`:
    - Add constant `REALTIME_RUN_KEY = "realtime_lifecycle_stream"`.
    - Add function `get_or_create_realtime_run(session: Session) -> str`:
      ```python
      def get_or_create_realtime_run(session: Session) -> str:
          run = session.query(PipelineRun).filter(PipelineRun.run_key == REALTIME_RUN_KEY).first()
          if run:
              return run.run_id
          new_id = str(uuid.uuid4())
          run = PipelineRun(
              run_id=new_id,
              run_key=REALTIME_RUN_KEY,
              started_at=datetime.now(timezone.utc),
              status="ACTIVE"
          )
          session.add(run)
          session.commit()
          return new_id
      ```
    - In `purge_prior_snapshot_runs(session, run_key, current_run_id)`:
      - Add guard: `if run_key == REALTIME_RUN_KEY: return` to guarantee the real-time stream is never purged.
- **Verification Commands:**
  - `python -c "from mplads_fraud_detection.foundation.db import SessionLocal, get_or_create_realtime_run; s=SessionLocal(); r1=get_or_create_realtime_run(s); r2=get_or_create_realtime_run(s); assert r1==r2; print('Stream Run ID:', r1); s.close()"`

#### Step 1.3: Isolation Forest Serialization & Reference Medians Setup
- **Objective:** Export trained Isolation Forest model artifacts and statistical reference medians to decouple real-time inference from full dataset scans.
- **Files to Create:**
  - `scripts/export_detector_models.py`:
    - Ensures `MODELS_DIR.mkdir(parents=True, exist_ok=True)` before serializing.
    - Ingests canonical works from database or verified CSV.
    - Fits `IsolationForest(n_estimators=200, random_state=42, n_jobs=-1)` on `[log_cost, execution_days, completion_month, cost_vs_category_median, cost_vs_district_median, days_per_lakh]`.
    - Computes and saves category medians, district medians, global medians, and anomaly threshold.
    - Serializes model to `artifacts/models/detector_01_isolation_forest.joblib`.
    - Serializes medians to `artifacts/models/detector_01_medians.json`.
- **Files to Modify:**
  - `mplads_fraud_detection/config.py`:
    - Add `D1_MODEL_PATH = MODELS_DIR / "detector_01_isolation_forest.joblib"`
    - Add `D1_MEDIANS_PATH = MODELS_DIR / "detector_01_medians.json"`
- **Verification Commands:**
  - `python scripts/export_detector_models.py`
  - `test -f artifacts/models/detector_01_isolation_forest.joblib`
  - `test -f artifacts/models/detector_01_medians.json`

---

### Phase 2: Core WorkLifecycleAuditor Engine

#### Step 2.1: `WorkLifecycleAuditor` Architecture & Savepoint Isolation
- **Objective:** Implement the master lifecycle auditor class managing nested savepoints (`session.begin_nested()`) so a single detector failure results in `audit_status = "PARTIALLY_AUDITED"` without rolling back healthy detections.
- **Files to Create:**
  - `mplads_fraud_detection/auditor/__init__.py`
  - `mplads_fraud_detection/auditor/lifecycle_auditor.py`:
    - Implements `WorkLifecycleAuditor`:
      ```python
      class WorkLifecycleAuditor:
          def __init__(self, model_path=None, medians_path=None):
              self.load_artifacts(model_path, medians_path)

          def audit_work(self, session: Session, work_or_id, commit: bool = False) -> Dict[str, Any]:
              work = session.query(Work).filter(Work.work_id == work_or_id).first() if isinstance(work_or_id, int) else work_or_id
              if not work:
                  raise ValueError(f"Work {work_or_id} not found")

              stream_run_id = get_or_create_realtime_run(session)
              evaluations = {}
              failed_detectors = []

              for det_name, eval_fn in self.get_evaluators().items():
                  try:
                      with session.begin_nested():
                          evaluations[det_name] = eval_fn(session, work)
                  except Exception as err:
                      logger.error(f"Detector {det_name} failed on work {work.work_id}: {err}", exc_info=True)
                      failed_detectors.append(det_name)
                      evaluations[det_name] = None

              sync_summary = self._sync_anomalies(session, work.work_id, stream_run_id, evaluations)
              
              work.last_audited_at = datetime.now(timezone.utc)
              work.lifecycle_audit_version = "v3.0"
              work.audit_status = "PARTIALLY_AUDITED" if failed_detectors else "AUDITED"

              if commit:
                  session.commit()

              return {
                  "work_id": work.work_id,
                  "audit_status": work.audit_status,
                  "last_audited_at": work.last_audited_at.isoformat(),
                  "active_anomalies": sync_summary["active_count"],
                  "resolved_anomalies": sync_summary["resolved_count"],
                  "newly_flagged": sync_summary["new_count"],
                  "failed_detectors": failed_detectors,
                  "details": sync_summary["details"]
              }
      ```
- **Files to Modify:**
  - `mplads_fraud_detection/__init__.py`: Export `WorkLifecycleAuditor`.

#### Step 2.2: 11 Direct In-Memory Detector Evaluators
- **Objective:** Build dedicated single-work evaluators for D1–D8, D10–D12, and D15.
- **Implementation in `mplads_fraud_detection/auditor/lifecycle_auditor.py`:**
  - **D1 (Unusual Patterns)**: Evaluates features against precomputed medians and `IsolationForest`. Decision score translated to severity via `monotonic_severity`. Fallback heuristic if model unpickling fails.
  - **D2 (Duplicate Works)**: Queries candidate works within the same district (or category) created within $\pm 365$ days. Computes character n-gram TF-IDF cosine similarity. If similarity $\ge 0.85$, flags duplicate scope and records matching `peer_work_id`. Performs cascading update on matching peer if reciprocal anomaly is missing.
  - **D3 (CPWD Cost Overruns)**: Parses physical dimensions using `extract_physical_quantity()`, looks up baseline unit rate from `AUTHORITATIVE_CPWD_RATES`, applies 1.15 AP terrain coefficient if district in `AP_DIFFICULT_TERRAIN_DISTRICTS`. If excess $> 20\%$, returns `severity >= 0.50`.
  - **D4 (Ghost Works & Payments)**: If `status == "completed"` and `payment_record_exists`: checks if `total_paid == 0` (severity 0.80) or `total_paid < 0.5 * cost`. Integrates MP-level gap if $\ge 40\%$. If `status != "completed"`, returns compliant (`None`).
  - **D5 (Bill Splitting / Smurfing)**: Checks if cost is in Band 5L (₹4.5L–₹5L) or Band 20L (₹18L–₹20L). If so, queries DB for peer works by same MP in same month. If peer count $\ge 2$, flags smurfing evasion.
  - **D6 (Delay Violation)**: If `recommended_date` is present: computes elapsed days to `completion_date` (if completed) or `DEFAULT_SNAPSHOT_AS_OF_DATE` (if ongoing). If duration $> 365$ days, flags delay violation.
  - **D7 (Timing Anomaly / March Rush)**: Checks if `completion_date` falls in March 25–31, cross-referencing MP March spend ratio.
  - **D8 (Bulk Completion)**: Checks if `status == "completed"`: queries count of works certified on the identical date by the same district/agency. If count $> 5$, flags paper bulk certification.
  - **D10 (Vague Description)**: Evaluates description length, 5 specificity markers (measurements, location, technical specs, scope, beneficiary), and boilerplate phrases. If cost $\ge$ ₹2L and specificity score $< 0.12$, flags ambiguity.
  - **D11 (Category Plausibility Bounds)**: Resolves category to `PLAUSIBILITY_BOUNDS` (min/max engineering bounds). If cost outside bounds, flags impossibility.
  - **D12 (Verification Gap)**: If `status == "completed"` and `payment_gap_percentage >= 40.0%`, flags missing physical MB or audit reconciliation gap.
  - **D15 (Copy-Paste Pricing)**: Checks if MP has $\ge 5$ works sanctioned at the identical non-round rupee amount across different categories.

#### Step 2.3: In-Place Soft-Resolution Upserts & Severity Floor Clipping
- **Objective:** Manage anomaly record state transitions against `uq_work_detector_run` with strict enforcement of `severity >= 0.50`.
- **Logic in `_sync_anomalies()`:**
  ```python
  def _sync_anomalies(self, session: Session, work_id: int, run_id: str, evaluations: Dict[str, Any]) -> Dict[str, Any]:
      existing_records = {
          a.detector_type: a
          for a in session.query(Anomaly).filter(
              Anomaly.work_id == work_id,
              Anomaly.run_id == run_id
          ).all()
      }

      active_count = 0
      resolved_count = 0
      new_count = 0
      details = []

      for det_type, eval_result in evaluations.items():
          # Enforce statutory severity floor: < 0.50 is treated as non-flagged (compliant)
          is_flagged = eval_result is not None and eval_result[0] >= 0.50
          existing = existing_records.get(det_type)

          if is_flagged:
              severity, explanation, evidence = eval_result
              # Clamp upper bound to 1.00 per CheckConstraint
              severity = min(1.00, max(0.50, round(float(severity), 3)))

              if existing:
                  existing.is_active = True
                  existing.severity = severity
                  existing.explanation = explanation
                  existing.evidence = evidence
                  existing.resolved_at = None
                  existing.resolution_reason = None
                  existing.detected_at = datetime.now(timezone.utc)
                  active_count += 1
                  details.append({"detector": det_type, "status": "REACTIVATED_OR_UPDATED", "severity": severity})
              else:
                  new_anomaly = Anomaly(
                      work_id=work_id,
                      detector_type=det_type,
                      severity=severity,
                      explanation=explanation,
                      evidence=evidence,
                      run_id=run_id,
                      is_active=True,
                      detected_at=datetime.now(timezone.utc)
                  )
                  session.add(new_anomaly)
                  active_count += 1
                  new_count += 1
                  details.append({"detector": det_type, "status": "NEW_ANOMALY", "severity": severity})

          else:
              # Finding is cleared or below statutory floor
              if existing and existing.is_active:
                  existing.is_active = False
                  existing.resolved_at = datetime.now(timezone.utc)
                  existing.resolution_reason = (
                      "Severity dropped below statutory floor (0.50)"
                      if (eval_result and eval_result[0] < 0.50)
                      else "Condition cleared by lifecycle re-audit"
                  )
                  resolved_count += 1
                  details.append({"detector": det_type, "status": "SOFT_RESOLVED", "reason": existing.resolution_reason})

      session.flush()
      return {
          "active_count": active_count,
          "resolved_count": resolved_count,
          "new_count": new_count,
          "details": details
      }
  ```

#### Step 2.4: Cold-Start ML Degradation Fallback
- **Objective:** Prevent runtime crashes when `detector_01_isolation_forest.joblib` is absent by falling back to heuristic category-cost bounds.
- **Logic:**
  ```python
  def _eval_d01_unusual_patterns(self, session: Session, work: Work):
      if self.d1_model is None or self.d1_medians is None:
          # Cold-start fallback: evaluate log-cost standard deviation
          log_cost = np.log10(max(1.0, float(work.cost)))
          # Heuristic: cost > 1 Crore with < 30 days or cost < 10,000
          if float(work.cost) > 10_000_000.0:
              return (0.75, "Cold-start statistical outlier: Project cost exceeds ₹1 Crore baseline", {"degraded_ml_mode": True, "cost": work.cost})
          return None
      # Normal model scoring...
  ```

---

### Phase 3: REST API Endpoints & Dual-Mode Security Gate

#### Step 3.1: Dual-Mode Security Gate (Standard Library JWT + Auth Demo Fallback)
- **Objective:** Implement stateless RFC 9110 Bearer JWT authentication using only Python standard library modules (`hmac`, `hashlib`, `base64`, `json`, `time`), with automatic fallback to `webapi/auth_demo.py` headers.
- **Files to Create:**
  - `webapi/security.py`:
    ```python
    import hmac
    import hashlib
    import base64
    import json
    import time
    from typing import Optional, Dict, Any, List
    from fastapi import Request, Header, HTTPException
    from mplads_fraud_detection.settings import settings

    def _b64_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    def _b64_decode(data: str) -> bytes:
        padded = data + "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode(padded)

    def create_jwt_token(payload: Dict[str, Any], secret_key: str, expires_in: int = 86400) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        claims = dict(payload)
        claims["exp"] = int(time.time()) + expires_in
        claims["iat"] = int(time.time())

        header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        claims_b64 = _b64_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header_b64}.{claims_b64}".encode("utf-8")

        signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
        sig_b64 = _b64_encode(signature)
        return f"{header_b64}.{claims_b64}.{sig_b64}"

    def decode_jwt_token(token: str, secret_key: str) -> Dict[str, Any]:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed token")
        header_b64, claims_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{claims_b64}".encode("utf-8")
        expected_sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()

        if not hmac.compare_digest(_b64_encode(expected_sig), sig_b64):
            raise ValueError("Invalid signature")

        claims = json.loads(_b64_decode(claims_b64).decode("utf-8"))
        if claims.get("exp", 0) < time.time():
            raise ValueError("Token expired")
        return claims

    def get_authenticated_user(
        request: Request,
        authorization: Optional[str] = Header(None),
        x_session_token: Optional[str] = Header(None),
        x_role: Optional[str] = Header(None),
        x_state: Optional[str] = Header(None),
        x_district: Optional[str] = Header(None)
    ) -> Dict[str, Any]:
        # Mode 1: RFC 9110 Bearer Token
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            try:
                claims = decode_jwt_token(token, settings.SECRET_KEY)
                return {
                    "user_id": claims.get("sub", "jwt_user"),
                    "role": claims.get("role", "viewer"),
                    "assigned_districts": claims.get("assigned_districts", [claims.get("district")] if claims.get("district") else []),
                    "state": claims.get("state", "ALL"),
                    "auth_mode": "jwt_bearer"
                }
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Invalid Bearer authentication: {e}")

        # Mode 2: Backward-Compatible auth_demo Fallback
        from webapi.auth_demo import get_current_user
        user = get_current_user(
            x_session_token=x_session_token,
            x_role=x_role,
            x_state=x_state,
            x_district=x_district
        )
        dist = user.get("district")
        user["assigned_districts"] = [dist] if dist and dist != "ALL" else []
        user["auth_mode"] = "demo_header"
        return user
    ```

#### Step 3.2: Multi-District Scoping (`assigned_districts`) & Role Verification
- **Objective:** Restrict write permissions on works to authorized roles with district-boundary enforcement.
- **Logic in `webapi/security.py`:**
  ```python
  def verify_work_authorization(user: Dict[str, Any], work: Work):
      role = user.get("role", "viewer").lower()

      # Superusers
      if role in ["admin", "mospi"]:
          return

      # State Nodal Officer
      if role == "state_nodal_officer":
          user_state = user.get("state", "").upper()
          if user_state in ["ALL", "ALL STATES"] or user_state == work.state.upper():
              return
          raise HTTPException(status_code=403, detail=f"Access denied: Work state '{work.state}' does not match assigned state '{user_state}'")

      # District Authority
      if role == "district_authority":
          assigned = [d.upper() for d in user.get("assigned_districts", [])]
          if "ALL" in assigned or work.district.upper() in assigned:
              return
          raise HTTPException(status_code=403, detail=f"Access denied: Work district '{work.district}' not in assigned districts {assigned}")

      raise HTTPException(status_code=403, detail=f"Access denied: Role '{role}' lacks permission to modify works")
  ```

#### Step 3.3: `PATCH /api/works/{work_id}` & Deprecated `POST /api/works/{work_id}/update`
- **Objective:** Create work modification endpoints, invoking `WorkLifecycleAuditor` and appending RFC 8594 Sunset and RFC 9745 Deprecation headers on the legacy POST route.
- **Files to Create:**
  - `webapi/routers/works.py`:
    ```python
    from fastapi import APIRouter, Depends, HTTPException, Response
    from pydantic import BaseModel, Field
    from typing import Optional
    from datetime import date
    from sqlalchemy.orm import Session

    from webapi.data_service import get_db
    from webapi.security import get_authenticated_user, verify_work_authorization
    from webapi.models import EnvelopeResponse
    from webapi.cache_manager import invalidate_all_aggregates
    from mplads_fraud_detection.foundation.schema import Work
    from mplads_fraud_detection.auditor.lifecycle_auditor import WorkLifecycleAuditor

    router = APIRouter()
    auditor = WorkLifecycleAuditor()

    class WorkUpdatePayload(BaseModel):
        cost: Optional[float] = Field(None, gt=0)
        status: Optional[str] = None
        completion_date: Optional[date] = None
        recommended_date: Optional[date] = None
        work_description: Optional[str] = None
        total_paid: Optional[float] = Field(None, ge=0)
        has_payments: Optional[bool] = None
        category: Optional[str] = None
        location: Optional[str] = None
        implementing_agency: Optional[str] = None

    def _execute_work_update(work_id: int, payload: WorkUpdatePayload, user: dict, db: Session) -> dict:
        work = db.query(Work).filter(Work.work_id == work_id).first()
        if not work:
            raise HTTPException(status_code=404, detail=f"Work #{work_id} not found")

        verify_work_authorization(user, work)

        # Apply mutations
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(work, field, val)

        work.updated_at = datetime.now(timezone.utc)
        
        # Trigger re-audit
        audit_result = auditor.audit_work(db, work, commit=False)
        db.commit()

        # Invalidate aggregate caches
        invalidate_all_aggregates()

        return {
            "work": {
                "work_id": work.work_id,
                "cost": work.cost,
                "status": work.status,
                "work_description": work.work_description,
                "district": work.district,
                "last_audited_at": work.last_audited_at.isoformat() if work.last_audited_at else None,
                "audit_status": work.audit_status,
                "lifecycle_audit_version": work.lifecycle_audit_version
            },
            "audit": audit_result
        }

    @router.patch("/works/{work_id}")
    def patch_work(work_id: int, payload: WorkUpdatePayload, user: dict = Depends(get_authenticated_user), db: Session = Depends(get_db)):
        result = _execute_work_update(work_id, payload, user, db)
        return EnvelopeResponse(data=result, meta=None, warnings=[])

    @router.post("/works/{work_id}/update")
    def post_work_update_deprecated(work_id: int, payload: WorkUpdatePayload, response: Response, user: dict = Depends(get_authenticated_user), db: Session = Depends(get_db)):
        # RFC 9745 Deprecation & RFC 8594 Sunset
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "Sat, 01 May 2027 00:00:00 GMT"
        response.headers["Link"] = f"</api/works/{work_id}>; rel=\"successor-version\""
        result = _execute_work_update(work_id, payload, user, db)
        return EnvelopeResponse(data=result, meta=None, warnings=["Endpoint POST /api/works/{id}/update is deprecated. Use PATCH /api/works/{id}."])
    ```
- **Files to Modify:**
  - `webapi/main.py`: Register `works.router` under `/api`.
  - `webapi/routers/flags.py`: Filter by `Anomaly.is_active == True` by default with optional `include_resolved: bool = Query(False)`.

#### Step 3.4: Invalidation of Aggregate Caches
- **Objective:** Provide an instant purge across all router-level and aggregator TTL caches.
- **Files to Create:**
  - `webapi/cache_manager.py`:
    ```python
    def invalidate_all_aggregates():
        from webapi.routers import flags, states, mps, districts, constituencies
        from webapi import aggregators

        flags._flags_cache.clear()
        states._states_cache.clear()
        mps._mps_cache.clear()
        mps._mp_detail_cache.clear()
        districts._districts_cache.clear()
        districts._district_detail_cache.clear()
        districts._districts_maps_cache = None
        constituencies._constituency_cache.clear()
        aggregators._CACHE.clear()
    ```

#### Step 3.5: Wiring `POST /api/mps/{id}/recommend-work` to Auditor
- **Objective:** Ensure all works newly recommended via the MP portal are audited upon insertion.
- **Files to Modify:**
  - `webapi/routers/mps.py`:
    - In `recommend_work()` (lines 528–550):
      ```python
      # Execute auditor immediately before commit
      auditor = WorkLifecycleAuditor()
      auditor.audit_work(db, new_work, commit=False)
      db.commit()
      invalidate_all_aggregates()
      ```

---

### Phase 4: Batch ETL Synchronization & 12 Automated Verification Scenarios

#### Step 4.1: ETL Diff Detection & Selective Re-Auditing
- **Objective:** Upgrade `load_works_into_db()` in `etl.py` to compare incoming records with existing database rows and selectively re-audit only mutated records.
- **Files to Modify:**
  - `mplads_fraud_detection/foundation/etl.py`:
    - In `load_works_into_db(session, df_unified)`:
      ```python
      # Diff detection loop
      mutated_work_ids = []
      for _, row in df_valid.iterrows():
          wid = int(row["work_id"])
          if wid in existing_works:
              w = existing_works[wid]
              # Detect changes
              if (
                  abs(w.cost - float(row["cost"])) > 1e-2 or
                  w.status != str(row["status"]) or
                  w.work_description != str(row.get("work_description", "")) or
                  w.completion_date != c_date or
                  w.recommended_date != r_date or
                  abs(w.total_paid - float(row.get("total_paid", 0.0))) > 1e-2
              ):
                  mutated_work_ids.append(wid)
                  # update fields...
          else:
              # New insert
              mutated_work_ids.append(wid)
              # add new work...

      session.flush()

      if mutated_work_ids:
          logger.info(f"Selectively re-auditing {len(mutated_work_ids)} mutated works...")
          auditor = WorkLifecycleAuditor()
          auditor.audit_works_batch(session, mutated_work_ids)

      session.commit()
      ```

#### Step 4.2: Comprehensive Test Suite (`tests/test_lifecycle_re_auditing.py`)
- **Objective:** Author a complete test suite covering all 12 operational test gates against an isolated temporary SQLite database fixture (`isolated_test_db`).
- **Files to Create:**
  - `tests/test_lifecycle_re_auditing.py`:
    - **Gate 1: Schema Integrity**: Verifies presence of `updated_at`, `last_audited_at`, `lifecycle_audit_version`, `audit_status`, `is_active`, `resolved_at`, `resolution_reason`, and composite indexes.
    - **Gate 2: Singleton Pipeline Run**: Verifies `get_or_create_realtime_run()` produces and persists a singleton record with `run_key='realtime_lifecycle_stream'`.
    - **Gate 3: Work Update & Audit Status**: Verifies updating a work sets `audit_status = 'AUDITED'` and records `last_audited_at`.
    - **Gate 4: In-Place Soft Resolution**: Verifies lowering a work cost from ₹35L to ₹10L transitions the D3 `cost_overrun` anomaly to `is_active = False` with `resolved_at` populated.
    - **Gate 5: Severity Floor Enforcement**: Verifies no row with `severity < 0.50` is inserted into `anomalies`.
    - **Gate 6: D2 Cascading Candidate Window**: Injects two works in the same district with identical titles (`"Construction of CC Road in GP-4"`). Verifies duplicate flag on both works.
    - **Gate 7: Cold-Start ML Degradation Fallback**: Deletes model artifact and verifies `audit_work()` completes cleanly in degraded mode without raising `FileNotFoundError`.
    - **Gate 8: RFC 9110 Bearer JWT Authentication**: Generates valid HS256 token using standard library, asserts HTTP 200 on `PATCH /api/works/{id}`. Asserts HTTP 401 on expired or signature-mismatched token.
    - **Gate 9: Backward-Compatible Demo Header Fallback**: Verifies `X-Session-Token` allows access when `Authorization` header is omitted.
    - **Gate 10: Multi-District Scoping & RBAC**: Asserts `district_authority` assigned to `["GUNTUR"]` receives HTTP 403 when updating a work in `VISAKHAPATNAM`.
    - **Gate 11: Deprecation & Sunset Headers**: Asserts `POST /api/works/{id}/update` returns HTTP headers `Deprecation: true`, `Sunset`, and `Link`.
    - **Gate 12: Aggregate Cache Invalidation**: Asserts updating an anomaly immediately clears `_flags_cache`, `_states_cache`, `_mps_cache`, `_districts_cache`, and `aggregators._CACHE`.

#### Step 4.3: Full Regression Certification (16/16 Gates)
- **Commands to Execute:**
  1. `pytest -v tests/test_lifecycle_re_auditing.py` (Assert 12/12 gates pass)
  2. `pytest -v tests/ -m "not slow"` (Assert zero unit/integration regressions)
  3. `bash tests/acceptance_tests.sh` (Assert 16/16 production acceptance gates pass)

---

## 4. Master File Action Matrix

| File Path | Action | Scope / Rationale |
|:---|:---|:---|
| `docs/WORK_LIFECYCLE_REAUDITING_PLAN.md` | **Create** | Authoritative plan documentation on disk for all team agents. |
| `mplads_fraud_detection/foundation/schema.py` | **Modify** | Add lifecycle columns & composite indexes to `Work` and `Anomaly`. |
| `migrations/versions/<rev_id>_realtime_lifecycle_reauditing.py` | **Create** | Reversible batch-mode migration supporting SQLite WAL and PostgreSQL TLS. |
| `mplads_fraud_detection/foundation/db.py` | **Modify** | Add `REALTIME_RUN_KEY` and `get_or_create_realtime_run()`; isolate from purges. |
| `mplads_fraud_detection/config.py` | **Modify** | Add D1 model and reference medians file paths. |
| `scripts/export_detector_models.py` | **Create** | Exporter for D1 Isolation Forest and medians without touching quarantined ML training code. |
| `mplads_fraud_detection/auditor/__init__.py` | **Create** | Auditor module initialization and exports. |
| `mplads_fraud_detection/auditor/lifecycle_auditor.py` | **Create** | Core `WorkLifecycleAuditor` engine with 11 detector evaluators, nested savepoints, and soft-resolution. |
| `mplads_fraud_detection/__init__.py` | **Modify** | Re-export `WorkLifecycleAuditor`. |
| `webapi/security.py` | **Create** | Standard library zero-dependency HS256 JWT, multi-district scoping, and auth_demo fallback. |
| `webapi/cache_manager.py` | **Create** | Centralized cache invalidator for all router and aggregator TTL caches. |
| `webapi/routers/works.py` | **Create** | `PATCH /api/works/{id}` and deprecated `POST /api/works/{id}/update`. |
| `webapi/routers/mps.py` | **Modify** | Connect `POST /api/mps/{id}/recommend-work` to `WorkLifecycleAuditor`. |
| `webapi/main.py` | **Modify** | Mount `works.router` under `/api`. |
| `mplads_fraud_detection/foundation/etl.py` | **Modify** | Field-level diff detection and `audit_works_batch()`. |
| `tests/test_lifecycle_re_auditing.py` | **Create** | Complete test suite covering Gates 1–12. |

### Protected Files (DO NOT TOUCH)
- `data/*` (All source CSVs remain immutable; national corpus pegged to ₹45,116,074,156.14).
- `scripts/train_model.py` (Must remain strictly quarantined with exit code 1 to protect Gate 15).
- `mplads_fraud_detection/detectors/detector_*.py` (Preserve batch entry signatures for `pipeline.py`).
- `tests/acceptance_tests.sh` (Strictly maintain all 16 acceptance gates without weakening).
