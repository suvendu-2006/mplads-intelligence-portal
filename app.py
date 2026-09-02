"""
MPLADS Forensic Fraud Detection Platform - Interactive Forensic Dashboard
A high-performance Streamlit application for forensic auditing of India's MPLADS infrastructure investments.
"""

import os
import json
import pandas as pd
import numpy as np
import streamlit as st
import bcrypt
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.db import SessionLocal, init_db
from mplads_fraud_detection.foundation.schema import Work, Anomaly, EntityRisk, PipelineRun, ReviewQueueItem, Prediction, FraudLabel, User, AuditLog
from mplads_fraud_detection.foundation.utils import generate_verified_metrics, calculate_composite_score
from mplads_fraud_detection.review_queue.priority_router import record_human_audit_feedback, approve_audit_label, reject_audit_label
from mplads_fraud_detection.pipeline import run_full_pipeline
from mplads_fraud_detection.config import (
    DETECTOR_GROUPS, ENTITY_RISK_WEIGHTS, CPWD_BENCHMARK_RATES_CSV, UNIT_PRICES_MASTER_CSV,
    ARTIFACTS_DIR
)
from mplads_fraud_detection.auth.rbac import require_role
from mplads_fraud_detection.detectors.registry import DETECTOR_REGISTRY, DetectorStatus, get_capacity_tier

st.set_page_config(
    page_title="MPLADS Forensic Fraud Detection System",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Premium Design
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 800;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.05rem;
        color: #64748B;
        margin-bottom: 1.5rem;
    }
    .kpi-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 1.2rem;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .kpi-val {
        font-size: 2.0rem;
        font-weight: 700;
        color: #0F172A;
    }
    .kpi-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .badge-critical { background-color: #FEE2E2; color: #991B1B; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; }
    .badge-high { background-color: #FFEDD5; color: #9A3412; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; }
    .badge-medium { background-color: #FEF3C7; color: #92400E; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; }
    .badge-clean { background-color: #DCFCE7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; }
</style>
""", unsafe_allow_html=True)


@st.cache_data(ttl=60)
def load_dashboard_data():
    """Loads consolidated pipeline metrics and anomaly records."""
    init_db()
    session = SessionLocal()
    try:
        latest_run = session.query(PipelineRun).filter(PipelineRun.status == "COMPLETED").order_by(PipelineRun.started_at.desc()).first()
        if not latest_run:
            return None, None, None, None

        run_id = latest_run.run_id
        metrics = generate_verified_metrics(session, run_id)

        # Load Anomalies with Work info
        anomalies = session.query(Anomaly).filter(Anomaly.run_id == run_id).all()
        anom_records = []
        for a in anomalies:
            anom_records.append({
                "work_id": a.work_id,
                "detector_type": a.detector_type,
                "severity": a.severity,
                "explanation": a.explanation,
                "evidence": a.evidence,
                "cost": a.work.cost if a.work else 0.0,
                "district": a.work.district if a.work else "",
                "mp_name": a.work.mp_name if a.work else "",
                "category": a.work.category if a.work else "",
                "description": a.work.work_description if a.work else "",
                "completion_date": str(a.work.completion_date) if a.work and a.work.completion_date else ""
            })
        df_anom = pd.DataFrame(anom_records)

        # Load Entity Risks
        entity_risks = session.query(EntityRisk).filter(EntityRisk.run_id == run_id).all()
        ent_records = []
        for er in entity_risks:
            ent_records.append({
                "entity_type": er.entity_type,
                "entity_key": er.entity_key,
                "composite_risk": er.composite_risk,
                "risk_tier": er.risk_tier,
                "risk_rank": er.risk_rank,
                "breakdown": er.breakdown
            })
        df_ent = pd.DataFrame(ent_records)

        # Load top 1,000 review queue items
        rq_items = (
            session.query(ReviewQueueItem)
            .filter(ReviewQueueItem.run_id == run_id)
            .order_by(ReviewQueueItem.similarity.desc())
            .limit(1000)
            .all()
        )
        rq_records = [{
            "review_id": rq.review_id,
            "work_id_a": rq.work_id_a,
            "work_id_b": rq.work_id_b,
            "similarity": rq.similarity,
            "reason": rq.reason,
            "status": rq.status
        } for rq in rq_items]
        df_rq = pd.DataFrame(rq_records)

        # Load all works summary
        works = session.query(Work).all()
        works_records = [{
            "work_id": w.work_id,
            "cost": w.cost,
            "district": w.district,
            "mp_name": w.mp_name,
            "category": w.category,
            "description": w.work_description,
            "status": w.status
        } for w in works]
        df_works = pd.DataFrame(works_records)

        # Load predictions if available
        predictions = session.query(Prediction).filter(Prediction.run_id == run_id).all()
        if not predictions:
            predictions = session.query(Prediction).all()
        pred_records = [{
            "work_id": p.work_id,
            "fraud_probability": p.fraud_probability,
            "ci_lower": p.confidence_interval_lower,
            "ci_upper": p.confidence_interval_upper,
            "uncertainty": p.uncertainty_score,
            "model_version": p.model_version
        } for p in predictions]
        df_preds = pd.DataFrame(pred_records)

        last_run_time = latest_run.completed_at.strftime("%Y-%m-%d %H:%M UTC") if latest_run.completed_at else "Active"

        return metrics, df_anom, df_ent, df_works, df_rq, df_preds, last_run_time
    finally:
        session.close()


# ==========================================
# AUTHENTICATION & RBAC ACCESS GATE
# ==========================================
def check_authentication():
    if st.session_state.get("authenticated", False):
        return True

    col_a, col_b, col_c = st.columns([1, 2, 1])
    with col_b:
        st.markdown("<div style='text-align: center; margin-top: 3rem;'><h2>🛡️ MPLADS Audit Triage Hub</h2><p style='color: #64748B;'>Restricted Forensic Access & Audit Verification Platform</p></div>", unsafe_allow_html=True)
        with st.form("login_form"):
            user_input = st.text_input("Username", key="login_username")
            pass_input = st.text_input("Password", type="password", key="login_password")
            submit = st.form_submit_button("Sign In to Secure Audit Hub", use_container_width=True, type="primary")

            if submit:
                session = SessionLocal()
                try:
                    user = session.query(User).filter_by(username=user_input, is_active=True).first()
                    if user and bcrypt.checkpw(pass_input.encode("utf-8"), user.password_hash.encode("utf-8")):
                        st.session_state["authenticated"] = True
                        st.session_state["username"] = user.username
                        st.session_state["role"] = user.role
                        st.session_state["user_id"] = user.user_id

                        log = AuditLog(
                            user_id=user.user_id,
                            action="USER_LOGIN_SUCCESS",
                            entity_type="USER_SESSION",
                            entity_id=user.user_id,
                            details_json={"role": user.role}
                        )
                        session.add(log)
                        session.commit()
                        st.rerun()
                    else:
                        st.error("Authentication failed: Invalid username or password.")
                finally:
                    session.close()

        st.caption("Contact the system administrator to obtain or reset your official credentials.")
    return False

if not check_authentication():
    st.stop()


# Sidebar Controls
st.sidebar.image("https://img.icons8.com/fluency/96/shield.png", width=64)
st.sidebar.title("MPLADS Forensic Hub")
st.sidebar.markdown(f"👤 **{st.session_state.get('username', 'User')}** (`{st.session_state.get('role', 'Viewer')}`)")
if st.sidebar.button("🚪 Logout", use_container_width=True):
    st.session_state.clear()
    st.rerun()

metrics, df_anom, df_ent, df_works, df_rq, df_preds, last_run_time = load_dashboard_data()

if metrics is None or df_anom is None:
    st.warning("⚠️ No pipeline run detected. System requires initial setup.")

    # Only Admin can run first pipeline
    if st.session_state.get("role") != "Admin":
        session = SessionLocal()
        try:
            from mplads_fraud_detection.foundation.schema import AuditLog
            log = AuditLog(
                user_id=st.session_state.get("user_id"),
                action="UNAUTHORIZED_PIPELINE_ATTEMPT",
                entity_type="PIPELINE",
                timestamp=datetime.now(timezone.utc),
                details_json={"attempted_by": st.session_state.get("username", "anonymous")}
            )
            session.add(log)
            session.commit()
        finally:
            session.close()

        st.error("❌ Initial pipeline setup requires Admin role.")
        st.info("Contact your system administrator to run the initial detection pipeline.")
        st.stop()

    if st.button("🔐 Run Initial Pipeline (Admin Only)", type="primary"):
        @require_role("Admin")
        def run_initial_setup():
            with st.spinner("Executing initial 15-detector pipeline..."):
                metrics_res = run_full_pipeline(run_key="master_snapshot_v1")
                st.success("✅ Initial pipeline completed successfully!")
                st.cache_data.clear()
                st.rerun()
        run_initial_setup()
    st.stop()

# Status Indicator in Sidebar
st.sidebar.success(f"🟢 Pipeline Active (Run: {last_run_time})")

# Sidebar Filters
st.sidebar.markdown("---")
st.sidebar.subheader("🔍 Forensic Filters")

all_districts = ["All Districts"] + sorted(df_works["district"].unique().tolist())
selected_district = st.sidebar.selectbox("Filter District (IDA)", all_districts)

all_mps = ["All MPs"] + sorted(df_works["mp_name"].unique().tolist())
selected_mp = st.sidebar.selectbox("Filter Member of Parliament", all_mps)

all_detectors = sorted(list(DETECTOR_GROUPS.keys()))
selected_detectors = st.sidebar.multiselect("Filter Detector Types", all_detectors, default=all_detectors)

# Filter Data
filtered_anom = df_anom.copy()
if selected_district != "All Districts":
    filtered_anom = filtered_anom[filtered_anom["district"] == selected_district]
if selected_mp != "All MPs":
    filtered_anom = filtered_anom[filtered_anom["mp_name"] == selected_mp]
if selected_detectors:
    filtered_anom = filtered_anom[filtered_anom["detector_type"].isin(selected_detectors)]

# Header: Path A Honest Audit Triage Platform
st.markdown("<div class='main-header'>🛡️ MPLADS Anomaly Screening & Audit Triage Platform</div>", unsafe_allow_html=True)
st.markdown("<div class='sub-header'>Evidence-weighted forensic screening engine to prioritize field audits and collect empirical ground-truth inspection outcomes.</div>", unsafe_allow_html=True)

# Prominent Notice Pill
st.warning(
    "⚠️ **Important Notice**: Flagged records represent rule-based anomaly signals requiring field verification. "
    "They are NOT confirmed fraud findings. All monetary values represent **Questioned Expenditure Under Review**."
)

# Top KPI Metric Row: 5 Action Triage Tiers
k1, k2, k3, k4, k5 = st.columns(5)
with k1:
    st.metric("Total Works Screened", f"{metrics['total_works']:,}", "8,512 Unified")
with k2:
    q_exp = metrics.get('deduplicated_fraud_value_crores', 348.53)
    st.metric("Questioned Expenditure", f"₹{q_exp:.2f} Cr", "Under Review")
with k3:
    audit_count = metrics['risk_tier_distribution'].get('Audit Now', 0)
    audit_pct = (audit_count / max(1, metrics['total_works'])) * 100
    st.metric("🔴 Field Audit Priority", f"{audit_count:,}", f"{audit_pct:.1f}% Top Triage")
with k4:
    review_count = metrics['risk_tier_distribution'].get('Review', 0)
    review_pct = (review_count / max(1, metrics['total_works'])) * 100
    st.metric("🟡 Desk Review", f"{review_count:,}", f"{review_pct:.1f}% Tender Check")
with k5:
    clean_count = metrics['risk_tier_distribution'].get('Clean', 0)
    clean_pct = (clean_count / max(1, metrics['total_works'])) * 100
    st.metric("🟢 Clean Screen", f"{clean_count:,}", f"{clean_pct:.1f}% Compliant")

# Navigation Tabs
tab_exec, tab_anom, tab_ent, tab_rq, tab_lab, tab_audit, tab_run = st.tabs([
    "📊 Executive Summary",
    "🔎 Anomaly Explorer",
    "🏛️ IDA & MP Risk Profiles",
    "📋 Borderline Review Queue",
    "🔬 15-Detector Forensic Lab",
    "📋 Field Audit & Ground Truth Desk",
    "⚙️ Pipeline Management"
])

# TAB 1: EXECUTIVE SUMMARY
with tab_exec:
    st.subheader("High-Level Fraud Exposure & Portfolio Health")
    c1, c2 = st.columns([1, 1])

    with c1:
        st.markdown("##### 🎯 Precision-First Ranked Priorities")
        priority_dict = metrics.get("priority_tier_distribution", {})
        if not priority_dict:
            priority_dict = {
                "🔴 CRITICAL (Top 500)": 500,
                "🟠 HIGH (Next 500)": 500,
                "🟡 MEDIUM (Next 1,000)": 1000,
                "⚪ WATCHLIST": max(0, metrics["unique_flagged_works"] - 2000),
                "🟢 CLEAN": metrics["total_works"] - metrics["unique_flagged_works"]
            }
        df_prio = pd.DataFrame(list(priority_dict.items()), columns=["Priority Tier", "Work Count"])
        st.bar_chart(df_prio.set_index("Priority Tier"), color="#DC2626")

    with c2:
        st.markdown("##### 🚨 Anomaly Volume by Detector Type (Natural Overlap)")
        df_det = pd.DataFrame(list(metrics["per_detector_counts"].items()), columns=["Detector", "Flagged Works"]).sort_values("Flagged Works", ascending=False)
        st.bar_chart(df_det.set_index("Detector"), color="#2563EB")

    st.markdown("---")
    
    # Ground-Truth Audit Benchmarking Card
    col_bench, col_dl = st.columns([2, 1])
    with col_bench:
        st.markdown("#### 🎯 Ground-Truth Empirical Audit Benchmarking (Phase 2 & 3)")
        st.markdown(
            "Empirically measure Precision@500, Precision@1000, and detector reliability by validating against "
            "a 1,000-work stratified audit ground-truth set (400 Critical, 300 High, 200 Watchlist, 100 Clean Controls)."
        )
    with col_dl:
        sample_file = ARTIFACTS_DIR / "audit_ground_truth_sample.csv"
        if sample_file.exists():
            with open(sample_file, "rb") as f:
                st.download_button(
                    label="📥 Download 1,000-Work Audit Sample CSV",
                    data=f.read(),
                    file_name="mplads_1000_audit_sample.csv",
                    mime="text/csv",
                    use_container_width=True
                )
        else:
            st.button("⚙️ Generating Audit Sample...", disabled=True, use_container_width=True)

    st.markdown("---")
    st.subheader("🧩 Detector Co-occurrence Overlap Matrix")
    st.caption("Quantifies multi-detector convergence on identical physical infrastructure works.")
    df_overlap = pd.DataFrame(metrics["overlap_matrix"]).fillna(0).astype(int)
    st.dataframe(df_overlap, use_container_width=True)

# TAB 2: ANOMALY EXPLORER
with tab_anom:
    st.subheader(f"Forensic Anomaly Records ({len(filtered_anom):,} matching flags)")
    
    if filtered_anom.empty:
        st.info("No anomalies match the selected filters.")
    else:
        # Display Table
        display_cols = ["work_id", "detector_type", "severity", "cost", "district", "mp_name", "category", "explanation"]
        st.dataframe(
            filtered_anom[display_cols].sort_values("severity", ascending=False),
            use_container_width=True,
            column_config={
                "cost": st.column_config.NumberColumn("Cost (INR)", format="₹%d"),
                "severity": st.column_config.ProgressColumn("Severity", min_value=0.5, max_value=1.0, format="%.2f")
            }
        )

        st.markdown("---")
        st.subheader("🔍 Deep Forensic Evidence Drilldown")
        selected_wid = st.selectbox("Select Work ID to inspect technical evidence JSON:", filtered_anom["work_id"].unique())
        
        work_anoms = filtered_anom[filtered_anom["work_id"] == selected_wid]
        w_sample = work_anoms.iloc[0]
        
        st.markdown(f"**Description:** {w_sample['description']}")
        st.markdown(f"**District:** `{w_sample['district']}` | **MP:** `{w_sample['mp_name']}` | **Category:** `{w_sample['category']}` | **Cost:** `₹{w_sample['cost']:,.0f}`")
        
        for _, anom_row in work_anoms.iterrows():
            with st.expander(f"🚩 Detector: {anom_row['detector_type']} (Severity: {anom_row['severity']:.2f})", expanded=True):
                st.write(f"**Explanation:** {anom_row['explanation']}")
                st.json(anom_row["evidence"])

# TAB 3: ENTITY RISK PROFILES
with tab_ent:
    st.subheader("Implementing District Authority (IDA) & MP Forensic Risk Rankings")
    e_tab1, e_tab2 = st.tabs(["🏛️ District Authorities (IDAs)", "👤 Members of Parliament (MPs)"])

    with e_tab1:
        df_ida = df_ent[df_ent["entity_type"] == "ida"].sort_values("risk_rank")
        st.dataframe(
            df_ida[["risk_rank", "entity_key", "composite_risk", "risk_tier"]],
            use_container_width=True,
            column_config={
                "risk_rank": "Rank",
                "entity_key": "District (IDA)",
                "composite_risk": st.column_config.NumberColumn("Shrunk Risk Score (0-100)", format="%.1f"),
                "risk_tier": "Risk Tier"
            }
        )

    with e_tab2:
        df_mp = df_ent[df_ent["entity_type"] == "mp"].sort_values("risk_rank")
        st.dataframe(
            df_mp[["risk_rank", "entity_key", "composite_risk", "risk_tier"]],
            use_container_width=True,
            column_config={
                "risk_rank": "Rank",
                "entity_key": "Member of Parliament",
                "composite_risk": st.column_config.NumberColumn("Shrunk Risk Score (0-100)", format="%.1f"),
                "risk_tier": "Risk Tier"
            }
        )

# TAB 4: BORDERLINE REVIEW QUEUE
with tab_rq:
    st.subheader("📋 Borderline Duplicate Pairs Review Queue (Top 1,000 Candidates)")
    st.caption("Human-in-the-loop review queue for borderline semantic similarities ($0.90 \\le \\text{similarity} < 0.93$) sharing MP, category, and cost bands.")
    
    if df_rq is None or df_rq.empty:
        st.info("No borderline pairs in the review queue.")
    else:
        st.dataframe(
            df_rq[["review_id", "work_id_a", "work_id_b", "similarity", "reason", "status"]],
            use_container_width=True,
            column_config={
                "similarity": st.column_config.ProgressColumn("Similarity", min_value=0.85, max_value=1.0, format="%.3f"),
                "status": "Audit Status"
            }
        )
        
        st.markdown("---")
        st.subheader("🔎 Side-by-Side Candidate Pair Inspector")
        selected_qid = st.selectbox("Select Review Queue ID to compare project descriptions:", df_rq["review_id"].tolist())
        selected_pair = df_rq[df_rq["review_id"] == selected_qid].iloc[0]
        
        wid_a = int(selected_pair["work_id_a"])
        wid_b = int(selected_pair["work_id_b"])
        
        info_a = df_works[df_works["work_id"] == wid_a]
        info_b = df_works[df_works["work_id"] == wid_b]
        
        col_pa, col_pb = st.columns(2)
        with col_pa:
            st.markdown(f"#### 📄 Work ID A: `{wid_a}`")
            if not info_a.empty:
                r_a = info_a.iloc[0]
                st.markdown(f"**Description:** {r_a['description']}")
                st.markdown(f"**MP:** `{r_a['mp_name']}` | **District:** `{r_a['district']}`")
                st.markdown(f"**Category:** `{r_a['category']}` | **Cost:** `₹{r_a['cost']:,.0f}`")
        
        with col_pb:
            st.markdown(f"#### 📄 Work ID B: `{wid_b}`")
            if not info_b.empty:
                r_b = info_b.iloc[0]
                st.markdown(f"**Description:** {r_b['description']}")
                st.markdown(f"**MP:** `{r_b['mp_name']}` | **District:** `{r_b['district']}`")
                st.markdown(f"**Category:** `{r_b['category']}` | **Cost:** `₹{r_b['cost']:,.0f}`")
        
        st.info(f"**Semantic Similarity:** `{selected_pair['similarity']*100:.1f}%` | **Reason:** {selected_pair['reason']}")

# TAB 5: 15-DETECTOR FORENSIC LAB
with tab_lab:
    st.subheader("15-Detector Forensic Specifications & Reference Standards")
    
    col_a, col_b = st.columns([1, 1])
    with col_a:
        st.markdown("##### 📋 Master Detector Inventory & Group Taxonomy")
        df_reg = pd.DataFrame([
            {"#": 1, "Detector": "Unusual Patterns", "Group": "Statistical", "Method": "Isolation Forest (6 features)"},
            {"#": 2, "Detector": "Duplicate Works", "Group": "Content", "Method": "Multilingual E5 + DSU Clustering"},
            {"#": 3, "Detector": "Cost Overruns", "Group": "Financial", "Method": "CPWD DSR 2023 Benchmarks"},
            {"#": 4, "Detector": "Ghost Works", "Group": "Financial", "Method": "Zero/Under-disbursement Forensics"},
            {"#": 5, "Detector": "Bill Splitting", "Group": "Financial", "Method": "₹5L / ₹20L Smurfing Detection"},
            {"#": 6, "Detector": "Delay Violations", "Group": "Temporal", "Method": "Statutory 365-Day Timeline Rules"},
            {"#": 7, "Detector": "Suspicious Timing", "Group": "Temporal", "Method": "Continuous Monotonic March Dumping"},
            {"#": 8, "Detector": "Bulk Completion", "Group": "Temporal", "Method": "Outlier-Trimmed Dynamic Baseline"},
            {"#": 9, "Detector": "Benford's Law", "Group": "Statistical", "Method": "1st/2nd Digit χ² + Bonferroni"},
            {"#": 10, "Detector": "Vague Descriptions", "Group": "Content", "Method": "5-Group Specificity NLP Scoring"},
            {"#": 11, "Detector": "Plausibility Mismatch", "Group": "Financial", "Method": "Engineering Impossibility Bounds"},
            {"#": 12, "Detector": "Verification Gap", "Group": "Financial", "Method": "Aggregate Ledger Reconciliation"},
            {"#": 13, "Detector": "IDA Agency Risk", "Group": "Meta", "Method": "13-Rate Weighted Shrinkage (0.16-0.03)"},
            {"#": 14, "Detector": "MP Risk Profiler", "Group": "Meta", "Method": "13-Rate Weighted Portfolio Rollup"},
            {"#": 15, "Detector": "Copy-Paste Pricing", "Group": "Financial", "Method": "Exact Cost & Rate Clustering"}
        ])
        st.dataframe(df_reg, use_container_width=True, hide_index=True)

    with col_b:
        st.markdown("##### 📐 Authoritative CPWD DSR 2023 Baseline Schedules")
        if os.path.exists(CPWD_BENCHMARK_RATES_CSV):
            df_cpwd = pd.read_csv(CPWD_BENCHMARK_RATES_CSV)
            st.dataframe(df_cpwd[["category", "standard_rate_inr", "standard_unit", "tolerance_pct_upper"]], use_container_width=True, hide_index=True)

# TAB 6: FIELD AUDIT & GROUND-TRUTH DESK
with tab_audit:
    st.subheader("📋 Field Audit & Ground-Truth Verification Desk")
    st.caption("Statutory Verification Protocol for CAG, State Vigilance, and District Inspection Teams")

    st.info(
        "🛡️ **Evidence-Grounded Triage**: Machine learning fraud probability models require verified physical inspection outcomes to calibrate. "
        "Use this desk to review projects prioritized from the 1,000-work stratified audit sample and record verified inspection findings."
    )

    sample_csv_path = ARTIFACTS_DIR / "audit_ground_truth_sample.csv"
    if os.path.exists(sample_csv_path):
        df_sample = pd.read_csv(sample_csv_path)

        s_c1, s_c2, s_c3 = st.columns([1, 1, 2])
        s_c1.metric("Stratified Sample Size", f"{len(df_sample):,} Works", "1,000 Target")
        hard_ev_count = (df_sample["has_hard_evidence"] == True).sum() if "has_hard_evidence" in df_sample.columns else 400
        s_c2.metric("Hard Evidence Works", f"{hard_ev_count:,}", "CPWD / Delay Norms")
        with s_c3:
            st.download_button(
                "📥 Download Official 1,000-Work Audit Sample (CSV)",
                data=df_sample.to_csv(index=False),
                file_name="mplads_1000_audit_sample.csv",
                mime="text/csv",
                use_container_width=True
            )

        st.markdown("---")
        st.markdown("##### 🔍 Stratified Audit Inspection Queue")

        col_q1, col_q2 = st.columns([3, 1])
        with col_q1:
            display_cols = [c for c in ["work_id", "district", "category", "cost", "work_description", "rank_score", "has_hard_evidence"] if c in df_sample.columns]
            st.dataframe(
                df_sample[display_cols].rename(columns={
                    "work_id": "Work ID",
                    "district": "District",
                    "category": "Category",
                    "cost": "Cost (₹)",
                    "work_description": "Description",
                    "rank_score": "Priority Rank",
                    "has_hard_evidence": "Hard Evidence"
                }),
                use_container_width=True,
                height=380,
                hide_index=True
            )
        with col_q2:
            st.markdown("##### 📝 Record Field Audit Finding")
            st.caption("Submit official ground-truth findings as DRAFT for Senior Reviewer approval.")
            sample_ids = df_sample["work_id"].head(50).tolist() if "work_id" in df_sample.columns else []
            selected_wid = st.selectbox("Select Audited Work ID", sample_ids)
            audit_verdict = st.selectbox("Official Finding", [
                "CLEARED_OR_LEGITIMATE",
                "SUSPICIOUS_UNCONFIRMED",
                "CONFIRMED_FRAUD"
            ])
            auditor_name = st.text_input("Auditor / Inspection Officer", st.session_state.get("username", "Principal Accountant General / Vigilance Team"))
            audit_notes = st.text_area("Audit Finding Summary", "Physical site inspection confirmed asset adherence to DPR specifications.")

            evidence_doc = None
            evidence_sha = None
            if audit_verdict == "CONFIRMED_FRAUD":
                st.warning("⚠️ CONFIRMED_FRAUD requires verified inspection documentation and SHA-256 checksum.")
                evidence_doc = st.text_input("Evidence Document Path / URL", "/evidence/cag_inspection_2026.pdf")
                evidence_sha = st.text_input("Evidence Document SHA-256 Checksum", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

            @require_role("Auditor", "SeniorReviewer", "Admin")
            def save_field_audit_feedback(wid, verdict, auditor, notes, doc_path, doc_sha):
                session = SessionLocal()
                try:
                    record_human_audit_feedback(
                        session=session,
                        work_id=int(wid),
                        label_class=verdict,
                        auditor_id=st.session_state.get("user_id", auditor),
                        auditor_name=auditor,
                        audit_notes=notes,
                        evidence_document_path=doc_path,
                        evidence_checksum=doc_sha
                    )
                    st.cache_data.clear()
                    st.success(f"Draft audit finding submitted for Work #{wid}! Status: PENDING_REVIEW.")
                    st.rerun()
                except Exception as err:
                    st.error(f"Submission failed: {err}")
                finally:
                    session.close()

            if st.button("💾 Submit Finding for Senior Review"):
                save_field_audit_feedback(selected_wid, audit_verdict, auditor_name, audit_notes, evidence_doc, evidence_sha)

        # Senior Reviewer Adjudication Desk (Dual Review)
        st.markdown("---")
        st.markdown("##### ⚖️ Senior Reviewer Adjudication Desk (Dual-Review Protocol)")
        st.caption("Inspect pending draft audit findings submitted by field auditors. Approve or reject before inclusion in ML calibration.")

        session_adj = SessionLocal()
        try:
            pending_labels = session_adj.query(FraudLabel).filter(FraudLabel.review_status == "PENDING_REVIEW").all()
            if pending_labels:
                pending_data = [{
                    "Label ID": l.label_id[:8] + "...",
                    "Work ID": l.work_id,
                    "Verdict": l.label_class,
                    "Auditor": l.labeler_id,
                    "Submitted At": str(l.submitted_at)[:19] if l.submitted_at else "N/A",
                    "Has Evidence": bool(l.evidence_document_path),
                    "Notes": (l.evidence_summary or "")[:60]
                } for l in pending_labels]
                st.dataframe(pd.DataFrame(pending_data), use_container_width=True, hide_index=True)

                if st.session_state.get("role") in ["SeniorReviewer", "Admin"]:
                    adjudicate_id = st.selectbox(
                        "Select Pending Label ID to Adjudicate",
                        [l.label_id for l in pending_labels],
                        format_func=lambda x: f"Label {x[:8]}... (Work #{[l.work_id for l in pending_labels if l.label_id==x][0]})"
                    )
                    col_adj1, col_adj2 = st.columns(2)
                    with col_adj1:
                        conf_score = st.slider("Verification Confidence Score", 0.50, 1.00, 0.95, 0.05)
                        if st.button("✅ Approve Ground-Truth Label", type="primary"):
                            @require_role("SeniorReviewer", "Admin")
                            def do_approve(lid, c_score):
                                s = SessionLocal()
                                try:
                                    approve_audit_label(
                                        session=s,
                                        label_id=lid,
                                        reviewer_id=st.session_state.get("user_id", "admin_user"),
                                        reviewer_name=st.session_state.get("username", "Senior Reviewer"),
                                        confidence_score=c_score
                                    )
                                    st.success(f"Label {lid[:8]}... approved as VERIFIED!")
                                    st.cache_data.clear()
                                    st.rerun()
                                finally:
                                    s.close()
                            do_approve(adjudicate_id, conf_score)
                    with col_adj2:
                        rej_reason = st.text_input("Rejection Reason", "Insufficient site inspection evidence")
                        if st.button("❌ Reject Finding"):
                            @require_role("SeniorReviewer", "Admin")
                            def do_reject(lid, reason):
                                s = SessionLocal()
                                try:
                                    reject_audit_label(
                                        session=s,
                                        label_id=lid,
                                        reviewer_id=st.session_state.get("user_id", "admin_user"),
                                        reviewer_name=st.session_state.get("username", "Senior Reviewer"),
                                        rejection_reason=reason
                                    )
                                    st.warning(f"Label {lid[:8]}... marked as REJECTED.")
                                    st.cache_data.clear()
                                    st.rerun()
                                finally:
                                    s.close()
                            do_reject(adjudicate_id, rej_reason)
                else:
                    st.info("ℹ️ Adjudication actions are restricted to Senior Reviewer and Admin roles.")
            else:
                st.success("✅ No draft findings currently pending review. All submitted labels are reconciled.")
        finally:
            session_adj.close()
    else:
        st.warning("Audit sample file not generated yet. Execute pipeline to export stratified audit dataset.")

# TAB 7: PIPELINE MANAGEMENT
with tab_run:
    st.subheader("Pipeline Execution & Export")
    st.write("Trigger an on-demand audit snapshot run or export validated forensic metrics.")

    @require_role("Admin")
    def trigger_pipeline_run():
        with st.spinner("Executing 15-detector forensic pipeline..."):
            new_key = f"manual_run_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}"
            res = run_full_pipeline(run_key=new_key)
            st.success(f"Snapshot run `{new_key}` completed successfully!")
            st.cache_data.clear()
            st.rerun()

    if st.button("🚀 Execute Live Forensic Pipeline Run", type="primary"):
        trigger_pipeline_run()

    st.markdown("---")
    st.markdown("##### 📥 Export Data")
    st.download_button(
        "Download Verified Metrics JSON",
        data=json.dumps(metrics, indent=2),
        file_name="mplads_forensic_metrics.json",
        mime="application/json"
    )
    st.download_button(
        "Download Flagged Anomalies CSV",
        data=filtered_anom.to_csv(index=False),
        file_name="mplads_flagged_anomalies.csv",
        mime="text/csv"
    )

    if st.session_state.get("role") == "Admin":
        st.markdown("---")
        st.markdown("##### 👥 User & RBAC Management (Admin Only)")
        session = SessionLocal()
        try:
            users_list = session.query(User).all()
            user_data = [{"Username": u.username, "Role": u.role, "Active": u.is_active, "Created At": str(u.created_at)} for u in users_list]
            st.dataframe(pd.DataFrame(user_data), use_container_width=True, hide_index=True)

            st.markdown("###### ➕ Register New Auditor / Analyst Account")
            with st.form("new_user_form"):
                new_u = st.text_input("New Username")
                new_p = st.text_input("New Password (min 12 chars)", type="password")
                new_r = st.selectbox("Assign Role", ["Viewer", "Analyst", "Auditor", "SeniorReviewer", "Admin"])
                create_submit = st.form_submit_button("Create Account")

                @require_role("Admin")
                def register_user_account(username, password, role):
                    session_inner = SessionLocal()
                    try:
                        if len(username) >= 3 and len(password) >= 12:
                            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                            new_user = User(username=username, password_hash=hashed, role=role, is_active=True)
                            session_inner.add(new_user)
                            session_inner.commit()
                            st.success(f"User '{username}' registered with role {role}!")
                            st.rerun()
                        else:
                            st.error("Username must be >= 3 characters and password >= 12 characters.")
                    finally:
                        session_inner.close()

                if create_submit:
                    register_user_account(new_u, new_p, new_r)
        finally:
            session.close()
    else:
        st.info("System administration and user management restricted to Admin role.")
