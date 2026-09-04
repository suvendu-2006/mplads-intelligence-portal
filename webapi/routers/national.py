from fastapi import APIRouter
from webapi.models import EnvelopeResponse, NationalOverview
from webapi.data_service import load_national_csv

router = APIRouter()

@router.get("/national", response_model=EnvelopeResponse[NationalOverview])
def get_national_overview():
    data = load_national_csv()
    overview = NationalOverview(
        totalAllocated=float(data.get("totalAllocated", 0.0)),
        totalExpenditure=float(data.get("totalExpenditure", 0.0)),
        utilizationPercentage=float(data.get("utilizationPercentage", 0.0)),
        totalMPs=int(data.get("totalMPs", 0)),
        totalWorksCompleted=int(data.get("totalWorksCompleted", 0)),
        totalWorksRecommended=int(data.get("totalWorksRecommended", 0)),
        completionRate=float(data.get("completionRate", 0.0)),
        totalTransactions=int(data.get("totalTransactions", 0)),
        avgAllocation=float(data.get("avgAllocation", 0.0)),
        pendingWorks=int(data.get("pendingWorks", 0)),
        paymentGap=float(data.get("paymentGap", 0.0)),
        completedWorksValue=float(data.get("completedWorksValue", 0.0)),
        inProgressPayments=float(data.get("inProgressPayments", 0.0))
    )
    return EnvelopeResponse(data=overview, meta=None, warnings=[])

_cached_analytics = None

@router.get("/national/analytics")
def get_national_analytics():
    global _cached_analytics
    if _cached_analytics is not None:
        return EnvelopeResponse(data=_cached_analytics, meta=None, warnings=[])

    from webapi.data_service import load_expenditures_csv, load_mplads_trends_csv, load_national_csv
    df = load_expenditures_csv()
    df_trends = load_mplads_trends_csv()
    nat = load_national_csv()
    official_exp = float(nat.get("totalExpenditure", 39642944289.14))

    if not df_trends.empty:
        raw_trends = [
            {
                'year': int(r['year']),
                'amount': float(r['total_expenditure']),
                'count': int(r['transactions']),
                'label': str(int(r['year']))
            }
            for _, r in df_trends.iterrows()
        ]
    else:
        yearly = df.groupby('year')['amountNorm'].agg(['sum', 'count']).reset_index()
        raw_trends = [
            {
                'year': int(r['year']),
                'amount': float(r['sum']),
                'count': int(r['count']),
                'label': str(int(r['year']))
            }
            for _, r in yearly.iterrows()
        ]

    # Reconcile yearly trend trajectory sum to official audited total
    raw_trends_sum = sum(t['amount'] for t in raw_trends) if raw_trends else 1.0
    scale_factor = official_exp / raw_trends_sum if raw_trends_sum > 0 else 1.0
    scaled_trends = [
        {
            'year': t['year'],
            'amount': round(t['amount'] * scale_factor, 2),
            'count': t['count'],
            'label': t['label']
        }
        for t in raw_trends
    ]

    total_amt = float(df['amountNorm'].sum()) if not df.empty else 1.0
    sectors = df.groupby('description')['amountNorm'].agg(['sum', 'count']).sort_values('sum', ascending=False).head(5).reset_index()
    
    # Friendly short names for UI display
    friendly_names = {
        'Construction of roads, link roads, pathways or any other road with or without drainage system': 'Roads, Pathways & Drainage',
        'Lighting of public spaces': 'Public Space Lighting',
        'Construction of community centers and community halls': 'Community Centers & Halls',
        'Street lights': 'Solar & Municipal Street Lights',
        'Construction of rooms and halls in school and colleges': 'School & College Classrooms'
    }

    top5_scaled = 0.0
    top_sectors = []
    for _, r in sectors.iterrows():
        share = float(r['sum']) / total_amt
        scaled_amt = round(share * official_exp, 2)
        top5_scaled += scaled_amt
        top_sectors.append({
            'fullName': r['description'],
            'name': friendly_names.get(r['description'], r['description'][:35]),
            'amount': scaled_amt,
            'count': int(r['count']),
            'sharePct': round(share * 100, 1)
        })

    other_share = round(max(0.0, 100.0 - sum(s['sharePct'] for s in top_sectors)), 1)
    other_amt = round(max(0.0, official_exp - top5_scaled), 2)
    top_sectors.append({
        'fullName': 'All Other Developmental & Socio-Economic Sectors (Health, Water, Sanitation, Irrigation, Sports)',
        'name': 'Other Socio-Economic Sectors',
        'amount': other_amt,
        'count': max(0, len(df) - int(sectors['count'].sum())),
        'sharePct': other_share
    })

    _cached_analytics = {
        'totalExpenditure': official_exp,
        'totalTransactions': len(df),
        'yearlyTrends': scaled_trends,
        'topSectors': top_sectors
    }
    return EnvelopeResponse(data=_cached_analytics, meta=None, warnings=[])
