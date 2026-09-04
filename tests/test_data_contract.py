import pytest
import pandas as pd
from webapi.config import DATA_DIR, OVERVIEW_DIR

def test_no_negative_pending_works():
    """Verify that all MPs have non-negative pending works (clamped >= 0)."""
    file_path = DATA_DIR / "all_mps_summary.csv"
    df = pd.read_csv(file_path)
    assert "pendingWorks" in df.columns, "pendingWorks column missing"
    negative_count = (df["pendingWorks"] < 0).sum()
    assert negative_count == 0, f"Found {negative_count} MPs with negative pendingWorks"

def test_no_negative_in_progress_payments():
    """Verify that all MPs have non-negative in-progress payments and payment gaps (clamped >= 0)."""
    file_path = DATA_DIR / "all_mps_summary.csv"
    df = pd.read_csv(file_path)
    assert "inProgressPayments" in df.columns, "inProgressPayments column missing"
    neg_progress = (df["inProgressPayments"] < 0).sum()
    assert neg_progress == 0, f"Found {neg_progress} MPs with negative inProgressPayments"
    neg_gap = (df["paymentGapPercentage"] < 0).sum()
    assert neg_gap == 0, f"Found {neg_gap} MPs with negative paymentGapPercentage"

def test_national_corpus_crore_calculation():
    """Verify that national overview amounts are correctly converted to Crores (10^7)."""
    file_path = OVERVIEW_DIR / "national_overview.csv"
    df = pd.read_csv(file_path)
    raw_allocated = float(df.iloc[0]["totalAllocated"])
    raw_expenditure = float(df.iloc[0]["totalExpenditure"])

    # 1 Crore = 10,000,000 (10^7)
    crores_allocated = raw_allocated / 10_000_000
    crores_expenditure = raw_expenditure / 10_000_000

    # 116,819,035,627.53 / 10^7 = 11,681.90 Crores (~11,682 Cr)
    assert 11600 <= crores_allocated <= 11700, f"Allocated crores calculation invalid: {crores_allocated}"
    assert round(crores_allocated) == 11682

    # 39,642,944,289.14 / 10^7 = 3,964.29 Crores (~3,964 Cr)
    assert 3900 <= crores_expenditure <= 4000, f"Expenditure crores calculation invalid: {crores_expenditure}"
    assert round(crores_expenditure) == 3964

def test_lakh_to_crore_scale():
    """Ensure no confusion between Lakhs (10^5) and Crores (10^7)."""
    rupees = 116819035627.53
    lakhs = rupees / 100_000
    crores = rupees / 10_000_000
    assert round(lakhs) == 1168190, "Lakhs value mismatch"
    assert round(crores) == 11682, "Crores value mismatch"
    assert (lakhs / crores) == pytest.approx(100.0), "Scale between Lakhs and Crores must be exactly 100x"

def test_three_way_reconciliation_national_states_mps():
    """Ensure exact mathematical equality between National, States, and MP summaries."""
    from webapi.config import DATA_DIR, OVERVIEW_DIR, STATES_DIR
    df_nat = pd.read_csv(OVERVIEW_DIR / "national_overview.csv")
    df_st = pd.read_csv(STATES_DIR / "all_states_summary.csv")
    df_mp = pd.read_csv(DATA_DIR / "all_mps_summary.csv")

    # 1. Recommended Works
    nat_rec = int(df_nat.iloc[0]["totalWorksRecommended"])
    st_rec = int(df_st["recommendedWorksCount"].sum())
    mp_rec = int(df_mp["recommendedWorksCount"].sum())
    assert nat_rec == 83968, f"National recommended works expected 83968, got {nat_rec}"
    assert st_rec == nat_rec, f"States recommended sum ({st_rec}) != National ({nat_rec})"
    assert mp_rec == nat_rec, f"MPs recommended sum ({mp_rec}) != National ({nat_rec})"

    # 2. Completed Works
    nat_comp = int(df_nat.iloc[0]["totalWorksCompleted"])
    st_comp = int(df_st["completedWorksCount"].sum())
    mp_comp = int(df_mp["completedWorksCount"].sum())
    assert nat_comp == 43735, f"National completed works expected 43735, got {nat_comp}"
    assert st_comp == nat_comp, f"States completed sum ({st_comp}) != National ({nat_comp})"
    assert mp_comp == nat_comp, f"MPs completed sum ({mp_comp}) != National ({nat_comp})"

    # 3. Allocated Corpus
    nat_alloc = float(df_nat.iloc[0]["totalAllocated"])
    st_alloc = float(df_st["totalAllocated"].sum())
    mp_alloc = float(df_mp["allocatedAmount"].sum())
    assert pytest.approx(nat_alloc, rel=1e-5) == 116819035627.53
    assert pytest.approx(st_alloc, rel=1e-5) == nat_alloc
    assert pytest.approx(mp_alloc, rel=1e-5) == nat_alloc

    # 4. Expenditure Disbursed
    nat_exp = float(df_nat.iloc[0]["totalExpenditure"])
    st_exp = float(df_st["totalExpenditure"].sum())
    mp_exp = float(df_mp["totalExpenditure"].sum())
    assert pytest.approx(nat_exp, rel=1e-5) == 39642944289.14
    assert pytest.approx(st_exp, rel=1e-5) == nat_exp
    assert pytest.approx(mp_exp, rel=1e-5) == nat_exp

def test_district_resolution_and_anomalies():
    """Verify that district details resolve real works, positive portfolio, and non-zero anomalies."""
    from webapi.main import app
    from starlette.testclient import TestClient
    client = TestClient(app)

    # 1. District directory returns real anomaly counts
    res_list = client.get("/api/districts?page=1&page_size=20")
    assert res_list.status_code == 200
    dist_items = res_list.json()["data"]
    non_zero_anoms = sum(1 for d in dist_items if d.get("anomalyCount", 0) > 0)
    assert non_zero_anoms > 0, "Expected non-zero anomalies in district directory"

    # 2. Key districts return real works and anomalies
    for d_name in ["PATNA", "SHIMLA", "KANGRA"]:
        res_detail = client.get(f"/api/districts/{d_name}")
        assert res_detail.status_code == 200
        data = res_detail.json()["data"]
        assert data["summary"]["worksCount"] > 0, f"Expected works in {d_name}"
        assert data["summary"]["portfolioValue"] > 0, f"Expected positive portfolio in {d_name}"
        assert data["summary"]["anomalyCount"] > 0, f"Expected anomalies in {d_name}"

def test_sectoral_donut_and_expenditure_canonicity():
    """Verify that national analytics returns 100% share sum and matches total expenditure."""
    from webapi.main import app
    from starlette.testclient import TestClient
    client = TestClient(app)

    res = client.get("/api/national/analytics")
    assert res.status_code == 200
    data = res.json()["data"]
    sectors = data["topSectors"]
    
    # 6 sectors total including other
    assert len(sectors) == 6, f"Expected 6 sectors, got {len(sectors)}"
    
    # Share percentage must sum to 100.0%
    total_share = sum(s["sharePct"] for s in sectors)
    assert pytest.approx(total_share, abs=0.2) == 100.0, f"Expected 100% share sum, got {total_share}"
    
    # Total expenditure must match official national figure
    assert pytest.approx(data["totalExpenditure"], rel=1e-5) == 39642944289.14

