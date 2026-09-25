#!/usr/bin/env python3
"""
Generates a clean, professional, normal PDF document covering all 15 SATARK MPLADS Fraud & Anomaly Detectors.
Features:
- Standard Letter size, clean 0.75 in margins.
- Clean typography (Helvetica), clear section hierarchy.
- Executive summary table with auto-wrapping text.
- 7 simple, structured sections for each of the 15 detectors.
- Dynamic page numbering (Page X of Y) and running header.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print 'Page X of Y'."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Don't draw header on first page
        if self._pageNumber > 1:
            self.drawString(54, 11 * 72 - 36, "SATARK MPLADS Intelligence Portal — Anomaly Detection Guide")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)
            
        # Running Footer on all pages
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 54, 36, page_str)
        self.drawString(54, 36, "CONFIDENTIAL — FOR AUDIT & VIGILANCE AUTHORITIES ONLY")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 46, 8.5 * 72 - 54, 46)
        
        self.restoreState()


def build_pdf(output_filename: str):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#475569"),
        spaceAfter=14
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=14,
        spaceAfter=3,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=7,
        spaceAfter=2,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=4
    )
    
    bullet_style = ParagraphStyle(
        'BulletItem',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=2
    )

    number_style = ParagraphStyle(
        'NumberItem',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        leftIndent=18,
        firstLineIndent=-12,
        spaceAfter=2
    )
    
    tag_style = ParagraphStyle(
        'TagStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#2563EB"),
        spaceAfter=6
    )

    tbl_hdr_style = ParagraphStyle(
        'TblHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    tbl_cell_style = ParagraphStyle(
        'TblCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#1E293B")
    )

    tbl_cell_bold = ParagraphStyle(
        'TblCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A")
    )

    example_box_style = ParagraphStyle(
        'ExampleBox',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # ------------------ COVER / HEADER ------------------
    story.append(Paragraph("SATARK MPLADS Intelligence Portal", title_style))
    story.append(Paragraph("Comprehensive Guide to the 15 Fraud & Anomaly Detectors", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1E3A8A"), spaceBefore=0, spaceAfter=10))

    intro_p = (
        "This document provides a clean, simple, and complete reference for all 15 anomaly and fraud detection engines "
        "deployed in the SATARK MPLADS platform. For every detector, this guide explains its core objective, data inputs, "
        "mathematical rules and thresholds, severity formulation, false-positive protections, sequential workflow, and a concrete real-world scenario."
    )
    story.append(Paragraph(intro_p, body_style))

    alert_text = (
        "<b>Core Investigative Philosophy:</b> Anomalies generated by these detectors are objective statistical warnings and screening leads. "
        "They pinpoint projects or entities requiring targeted physical verification or administrative scrutiny. An anomaly does not automatically prove deliberate corruption."
    )
    story.append(Paragraph(alert_text, body_style))
    story.append(Spacer(1, 10))

    # ------------------ MASTER SUMMARY TABLE ------------------
    story.append(Paragraph("Master Summary Table (Detectors 01 – 15)", h1_style))
    
    summary_headers = ["#", "Detector Name", "Plain-English Purpose", "Primary Trigger / Red Flag"]
    summary_rows = [
        ("01", "Unusual Pattern Detection", "Finds statistical outliers across cost and time", "Project radically deviates from peer works in district & category"),
        ("02", "Duplicate Work Detection", "Catches double-billing for the same physical work", "High semantic similarity (>=0.93) in descriptions within district"),
        ("03", "Cost Overrun Detection", "Checks if costs exceed official CPWD engineering rates", "Billed unit rate exceeds statutory ceiling by >=5% and >=₹10,000"),
        ("04", "Ghost Works Detection", "Identifies 'completed' projects with zero or tiny payments", "Project marked finished but payment ledger shows ₹0 or <50% paid"),
        ("05", "Bill Splitting (Smurfing)", "Catches splitting big projects to avoid tender limits", "Multiple contracts clustered just under ₹5 Lakh or ₹20 Lakh caps"),
        ("06", "Delays & Stalled Works", "Flags projects delayed far past the 1-year guideline", "Ongoing work exceeding 365 days or extreme historical completion delay"),
        ("07", "Suspicious Timing Forensics", "Detects year-end March dumping & pre-election rushes", "Over 40%–80% budget spent in March, or sudden 2x+ pre-election speedup"),
        ("08", "Same-Day Bulk Completion", "Flags massive batches of works signed off on 1 day", "District daily completions exceed Mean + 3x StdDev (e.g. 20+ works)"),
        ("09", "Round-Number & Benford", "Catches fake or fabricated numbers in cost estimates", "Abnormal concentration of exact round numbers (₹5L/₹10L) violating Benford"),
        ("10", "Vague Description Flag", "Flags projects with zero, short, or generic scopes", "Expensive projects described only as 'development work' or < 25 chars"),
        ("11", "Category-Amount Mismatch", "Ensures project cost is physically possible for work type", "Cost implausibly high (₹28L for 1 handpump) or low (₹45k for a school)"),
        ("12", "Verification Gap Flag", "Reconciles project sums with official MP ledger", "Sum of completed projects exceeds MP ledger balance by > 15%"),
        ("13", "IDA Risk Profiler", "Scores and ranks implementing districts on systemic risk", "District-level Empirical Bayes composite risk score (Top 10% Critical)"),
        ("14", "MP & Constituency Profiler", "Scores and ranks MP portfolios on systemic risk", "Parliamentarian portfolio Empirical Bayes risk score (Top 10% Critical)"),
        ("15", "Copy-Paste Pricing", "Identifies reused boilerplate estimates across works", "Same MP has >=5 works with identical cost across categories or unit rate")
    ]

    table_data = [[
        Paragraph(summary_headers[0], tbl_hdr_style),
        Paragraph(summary_headers[1], tbl_hdr_style),
        Paragraph(summary_headers[2], tbl_hdr_style),
        Paragraph(summary_headers[3], tbl_hdr_style)
    ]]

    for num, name, purpose, trigger in summary_rows:
        table_data.append([
            Paragraph(num, tbl_cell_bold),
            Paragraph(name, tbl_cell_bold),
            Paragraph(purpose, tbl_cell_style),
            Paragraph(trigger, tbl_cell_style)
        ])

    # Printable page width = 8.5 * 72 - 108 = 504 points
    col_widths = [24, 115, 175, 190]
    t_summary = Table(table_data, colWidths=col_widths, repeatRows=1)
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))

    story.append(t_summary)
    story.append(PageBreak())

    # ------------------ 15 DETAILED DETECTORS ------------------
    detectors = [
        {
            "id": "Detector 01",
            "name": "Unusual Pattern Detection (Isolation Forest)",
            "method": "Multivariate Statistical Outlier Analysis",
            "plain_summary": (
                "Instead of evaluating cost or duration in isolation, this detector looks at the entire combination of project features simultaneously. "
                "It asks: 'Does this project look radically strange compared to typical peer projects in the same district and work category?'"
            ),
            "inputs": [
                "<b>Log-Transformed Project Cost:</b> Compresses wide expenditure disparities (₹2 Lakh to ₹5 Crore) into a normalized scale.",
                "<b>Execution Duration (Days):</b> Elapsed time between official recommendation date and verified completion date.",
                "<b>Completion Month (1 to 12):</b> Cyclical indicator capturing operational timing across the financial calendar.",
                "<b>Category Median Cost Delta:</b> Percentage deviation from the robust median expenditure of works in the same category.",
                "<b>District Median Cost Delta:</b> Deviation from localized typical expenditure, adjusting for geographical price realities.",
                "<b>Days per Lakh Spent:</b> Efficiency metric (Duration ÷ (Cost / 100,000)) spotting abnormally fast or sluggish projects."
            ],
            "rules": [
                "<b>Minimum Dataset Guardrail:</b> Requires at least 50 valid completed projects in the database. Below this threshold, anomaly detection halts to prevent spurious scores.",
                "<b>Data Cleansing:</b> Automatically purges projects with missing completion dates or logically invalid dates (completion preceding recommendation).",
                "<b>Unsupervised Isolation:</b> Uses an Isolation Forest algorithm to isolate anomalous points via random feature partitioning trees without requiring labeled training fraud sets.",
                "<b>Anomaly Thresholding:</b> Projects with decision function scores falling into the lower distribution percentile are identified as statistical outliers."
            ],
            "severity": "Severity scales smoothly from 0.00 to 1.00 based on the outlier score. Marginal deviations receive 0.30–0.50, while extreme multi-dimensional deviations receive 0.80–1.00. Filtered against the global SEVERITY_FLOOR.",
            "safeguards": "Anomalies denote statistical distinctiveness, not deliberate fraud. Legitimate causes include specialized geological conditions, flood-relief emergency infrastructure, or custom engineering requirements.",
            "workflow": [
                "Query all completed works with valid recommendation and completion dates.",
                "Compute the 6 engineered features for each work.",
                "Verify that at least 50 completed projects exist in the dataset.",
                "Fit the Isolation Forest model on the standardized feature matrix.",
                "Calculate decision function anomaly scores and map to calibrated severity.",
                "Filter against the severity floor and persist anomaly records with feature attributions."
            ],
            "example_desc": "Typical community halls in District X take 180 to 240 days to build for ₹12 to ₹15 Lakh.",
            "example_scenario": "A hall project is recorded as costing ₹48 Lakh and completed in only 9 days. While neither cost nor time alone might trigger basic filters, the combination of 3x normal cost in 5% of normal time is flagged immediately as a severe multi-dimensional outlier."
        },
        {
            "id": "Detector 02",
            "name": "Duplicate Work Detection (NLP & Graph Clustering)",
            "method": "Natural Language Processing & Union-Find Clustering",
            "plain_summary": (
                "Detects potential double-billing or multi-funded projects where project descriptions describe essentially the same physical work "
                "despite variations in vocabulary, abbreviations, or phrasing (e.g., 'Construction of concrete road' vs. 'PCC road connecting village')."
            ),
            "inputs": [
                "<b>Work Description Text:</b> Natural language text describing the sanctioned scope of work.",
                "<b>District Name:</b> Comparisons are strictly partitioned by district (cross-district similarities are excluded).",
                "<b>Work Category & MP Name:</b> Used to confirm administrative and technical consistency.",
                "<b>Project Cost:</b> Compared using cost ratio bounds (0.70x to 1.43x)."
            ],
            "rules": [
                "<b>Length Gate:</b> Descriptions shorter than 20 characters (e.g., 'Road work') are excluded due to insufficient forensic specificity.",
                "<b>Template Exclusion:</b> Exact identical descriptions appearing > 10 times across the corpus are excluded as administrative boilerplate.",
                "<b>High-Confidence Direct Duplicate:</b> Cosine similarity >= 0.95, OR (similarity >= 0.93 + identical Category + Cost within 70%–143%).",
                "<b>Human Review Queue:</b> Borderline similarity (0.88 to 0.93) with identical MP, Category, District, and Cost is routed to a PENDING review desk rather than automatically flagged.",
                "<b>Union-Find Clustering:</b> Connected pairwise duplicates are merged into clusters of 2 to 10 works."
            ],
            "severity": "Base severity derives from the mean cosine similarity of the cluster. A +0.10 severity boost is added if all works in the cluster were recommended by the exact same MP. Capped at 1.00.",
            "safeguards": "Cross-district comparisons are prohibited, preventing false alarms between identical village names across different states. Boilerplate phrases are excluded.",
            "workflow": [
                "Filter out descriptions shorter than 20 characters or repeated > 10 times.",
                "Generate vector embeddings using Sentence Transformers (or TF-IDF fallback).",
                "Group embeddings strictly by district.",
                "Compute pairwise cosine similarity for all intra-district pairs.",
                "Categorize pairs into Ignored (<0.88), Review Queue (0.88–0.93 with metadata match), or High-Confidence (>=0.93/0.95).",
                "Merge duplicate pairs into connected components using Union-Find (clusters of 2 to 10 works).",
                "Persist anomaly records with cluster ID, related work IDs, and mean similarity."
            ],
            "example_desc": "Two project entries recorded under the same MP in District Y:",
            "example_scenario": "Work 101: 'Construction of 200m cement concrete road near Shiva Mandir, Ward 4' (₹8,00,000)\nWork 102: 'CC road construction 200m adjacent to Shiva temple Ward No 4' (₹7,95,000)\nCosine similarity is 0.96. The detector flags both as duplicate cluster members."
        },
        {
            "id": "Detector 03",
            "name": "Cost Overrun Detection (CPWD DSR Benchmarks)",
            "method": "Statutory Schedule of Rates & Engineering Economics",
            "plain_summary": (
                "Screens project invoices to verify whether billed unit rates exceed official Central Public Works Department (CPWD) "
                "Delhi Schedule of Rates (DSR 2023) statutory ceilings adjusted for compounding inflation and difficult terrain."
            ),
            "inputs": [
                "<b>CPWD DSR 2023 Benchmarks:</b> Baseline rates for CC roads, paver roads, handpumps, borewells, RO plants, school classrooms, community halls, lights, etc.",
                "<b>Compounding Inflation:</b> Automatic 6% annual compounding escalation applied for completion years after 2023.",
                "<b>Terrain Hardship Buffer:</b> Additional +15% statutory tolerance allowance automatically credited for projects in classified hill/remote districts.",
                "<b>Base Tolerance Buffer:</b> +25% buffer above standard rates to allow for localized market variances.",
                "<b>Extracted Quantity:</b> Linear meters, square meters, or item counts parsed from text descriptions."
            ],
            "rules": [
                "<b>Permissible Ceiling Formula:</b> Maximum Allowed Rate = Base Rate x (1 + 0.06)^(Years post-2023) x (1 + 0.25 Base Buffer + 0.15 Terrain Buffer).",
                "<b>Dual Overrun Threshold:</b> To trigger an alert, actual unit rate must exceed Permissible Ceiling by >= 5.0% AND estimated excess expenditure must be >= ₹10,000.",
                "<b>Quantity Confidence Scaling:</b> High confidence in text extraction assigns full severity; inferred or assumed quantities cap severity to prevent over-penalization."
            ],
            "severity": "Calibrated directly against excess percentage: 5% excess (0.30), 25% excess (0.50), 50% excess (0.75), >=100% excess (1.00). Reduced if quantity extraction confidence is moderate.",
            "safeguards": "Accounts for legitimate regional construction escalations through compounding inflation formulas and terrain multipliers before declaring an overrun.",
            "workflow": [
                "Match work description and category to CPWD benchmark master schedule.",
                "Compute statutory ceiling including inflation adjustment (6% p.a.) and district terrain status (+15%).",
                "Extract physical metrics (meters, square meters, unit counts) with confidence ranking.",
                "Calculate effective billed unit rate: Total Cost ÷ Extracted Quantity.",
                "Evaluate if Unit Rate > Ceiling, Overrun % >= 5%, and Total Excess >= ₹10,000.",
                "Scale severity, assemble evidence (excess amount, ceiling, actual rate), and persist."
            ],
            "example_desc": "A plain-area district builds a 100m CC road in 2024.",
            "example_scenario": "CPWD 2023 benchmark: ₹3,500/m. With 6% inflation + 25% buffer, ceiling is ₹4,650/m. Billed cost is ₹9,00,000 for 100m (₹9,000/m). Overrun is +93.5% with ₹4,35,000 excess expenditure -> Flagged with 0.95 Severity."
        },
        {
            "id": "Detector 04",
            "name": "Ghost Works Detection (Phantom Projects)",
            "method": "Financial Ledger Reconciliation & Timeline Triangulation",
            "plain_summary": (
                "Identifies projects certified as completed on paper but lacking corroborating financial disbursement records in verified "
                "accounting ledgers, signaling potential phantom billing or diversion of funds."
            ),
            "inputs": [
                "<b>Project Status:</b> Exclusively targets projects marked as 'completed'.",
                "<b>Verified Payment Ledger:</b> Strict verification of whether an actual payment transaction ledger exists (missing records are NOT assumed to be ₹0).",
                "<b>Disbursement Ratio:</b> Verified total amount paid divided by total claimed project cost.",
                "<b>MP Portfolio Payment Gap:</b> Macro-level unverified financial drawdown percentage across the parliamentarian's entire constituency."
            ],
            "rules": [
                "<b>Signal 1 (Zero Payment):</b> Verified payment record exists, project marked completed, but total disbursement is exactly ₹0 (Base Severity: 0.80).",
                "<b>Signal 2 (Severe Underpayment):</b> Verified payment record exists, but total disbursement is < 50% of claimed cost.",
                "<b>Signal 3 (MP Gap Context):</b> MP portfolio exhibits >= 40% aggregate payment gap across completed works.",
                "<b>Multi-Signal Compounding:</b> Final Severity = Max(Individual Signals) + 0.10 for each additional signal (max 1.00)."
            ],
            "severity": "Derived from compounding signals, modified by: (1) 30-day Recent Completion Grace (multiplied by 0.60 to allow accounting transit); (2) Small Project Buffer (< ₹50,000 multiplied by 0.80).",
            "safeguards": "Protects against missing data false positives by distinguishing 'missing payment record' (treated as unknown) from 'confirmed payment record showing ₹0'.",
            "workflow": [
                "Isolate records where status == 'completed'.",
                "Check if official payment transaction ledger entry exists.",
                "If record exists, check for ₹0 paid or < 50% disbursement ratio.",
                "Check MP portfolio unverified payment gap (>= 40%).",
                "Apply 30-day recent completion factor (0.60x) and <₹50k factor (0.80x).",
                "Filter by SEVERITY_FLOOR and persist evidence (claimed cost, paid amount, drawdown ratio)."
            ],
            "example_desc": "A community centre sanctioned for ₹25,00,000 is marked 'completed' 6 months ago.",
            "example_scenario": "The payment ledger shows exactly ₹0 released, and the MP portfolio has an overall 52% payment gap. Signal 1 (0.80) + Signal 3 (+0.10) triggers an anomaly with 0.90 Severity."
        },
        {
            "id": "Detector 05",
            "name": "Bill Splitting / Smurfing (Procurement Fragmentation)",
            "method": "Contract Value Distribution Analysis",
            "plain_summary": (
                "Detects deliberate contract splitting where large capital works are fragmented into multiple smaller contracts "
                "priced just below mandatory tender or executive sanction thresholds (specifically ₹5 Lakh and ₹20 Lakh limits)."
            ),
            "inputs": [
                "<b>₹5 Lakh Band:</b> Contracts priced between ₹4,50,000 and ₹4,99,999 (targeting the ₹5,00,000 procurement cap).",
                "<b>₹20 Lakh Band:</b> Contracts priced between ₹18,00,000 and ₹19,99,999 (targeting the ₹20,00,000 technical sanction cap).",
                "<b>Temporal Grouping:</b> Recommendations grouped by MP + Calendar Month + Smurf Band.",
                "<b>Category Homogeneity:</b> Evaluates whether fragmented contracts share identical infrastructure classifications (e.g. all Roads)."
            ],
            "rules": [
                "<b>5L Band Group Rule:</b> 3 to 4 works in the same month by same MP -> Flagged (Base Severity 0.60); >= 5 works -> Flagged (Base Severity 0.80). (Fewer than 3 ignored).",
                "<b>20L Band Group Rule:</b> >= 2 works in the same month by same MP AND cumulative sum >= ₹20,00,000 -> Flagged (Base Severity 0.70).",
                "<b>Category Homogeneity Boost:</b> If all works in the cluster share the exact same category, add +0.10 severity boost (max 1.00)."
            ],
            "severity": "Base severity (0.60 to 0.80) based on band and group density, plus 0.10 category boost. Filtered against SEVERITY_FLOOR.",
            "safeguards": "Requires temporal clustering (same month) and threshold proximity. Isolated sub-5L contracts or works across different months are not flagged.",
            "workflow": [
                "Filter records into 5L Band (₹4.5L–<₹5L) and 20L Band (₹18L–<₹20L).",
                "Group by MP Name + Recommendation Month + Band.",
                "Evaluate 5L count (>=3) or 20L criteria (>=2 works & sum >= ₹20L).",
                "Check if unique categories == 1 (apply +0.10 boost).",
                "Emit individual anomaly records for each constituent work in the smurfed cluster."
            ],
            "example_desc": "An MP sanctions 4 road works in October 2023 priced at ₹4,90,000, ₹4,95,000, ₹4,85,000, and ₹4,90,000.",
            "example_scenario": "Total expenditure is ₹19.6 Lakh. Instead of floating a single ₹20L tender, four contracts were issued just under the ₹5L tender limit. Cluster density >=3 + same category triggers 0.70 Severity."
        },
        {
            "id": "Detector 06",
            "name": "Delays & Stalled Works (Timeline Forensics)",
            "method": "Statutory Guideline Timeline Enforcement",
            "plain_summary": (
                "Catches ongoing public works stalled past the statutory 365-day (1-year) completion deadline, "
                "as well as finished projects that suffered extreme unapproved execution delays."
            ),
            "inputs": [
                "<b>Recommendation & Completion Dates:</b> Official administrative timestamps of sanction and physical completion.",
                "<b>As-of Analysis Snapshot:</b> Date reference used to compute elapsed operational duration for active works.",
                "<b>Execution Duration:</b> Elapsed calendar days calculated against the 365-day statutory guideline.",
                "<b>Multi-Phase Text Indicators:</b> Detection of keywords ('phase', 'stage', 'part', 'package') denoting legitimate multi-year infrastructure."
            ],
            "rules": [
                "<b>Stalled In-Progress Works:</b> Active works (status != 'completed' or missing completion date) with age > 365 days. Monotonic severity scale: 365 days (0.50), 548 days (0.65), 730 days (0.80), 1095 days (1.00).",
                "<b>Completed Delayed Works:</b> Finished works where duration > 365 days. Monotonic severity scale: 365 days (0.30), 548 days (0.45), 730 days (0.60), 1095 days (0.80).",
                "<b>Multi-Phase Safeguard:</b> If description contains multi-phase keywords, severity is multiplied by 0.80 and hard-capped at 0.69 (preventing Critical tier classification)."
            ],
            "severity": "Monotonically scaled from 0.30 to 1.00 based on elapsed delay past 1 year, discounted by 20% for multi-phase works.",
            "safeguards": "Differentiates stalled ongoing commitments from historical delays. Multi-phase packages are prevented from triggering critical emergency alerts.",
            "workflow": [
                "Purge records lacking valid recommendation dates.",
                "Check description for 'phase', 'stage', 'part', 'package'.",
                "Compute Age = as_of_date - rec_date (stalled) OR Duration = comp_date - rec_date (completed).",
                "Check if elapsed time > 365 days; compute delay days.",
                "Interpolate monotonic scale; apply 0.80x multiplier and 0.69 cap if multi-phase.",
                "Assemble timeline evidence (recommended date, completion date, days overdue) and save."
            ],
            "example_desc": "A drinking water pipeline sanctioned in January 2021 remains incomplete in October 2023 (1,000+ days).",
            "example_scenario": "The work is overdue by more than 635 days past the 365-day statutory guideline. Without multi-phase keywords, it receives a Critical 0.95 Severity alert for being stalled."
        },
        {
            "id": "Detector 07",
            "name": "Suspicious Timing Forensics (March Dumping & Term Rush)",
            "method": "Temporal Expenditure Concentration Analysis",
            "plain_summary": (
                "Identifies artificial project completions and budget dumping driven by accounting deadlines (fiscal year-end March dumping) "
                "or political electoral cycles (pre-election term rush)."
            ),
            "inputs": [
                "<b>Fiscal Calendar Mapping:</b> Indian financial year (April 1 to March 31).",
                "<b>March Concentration Index:</b> Weighted composite: 40% March Project Count % + 60% March Expenditure %.",
                "<b>Term-End Reference Date:</b> Fixed statutory reference (May 31, 2024 for 17th Lok Sabha).",
                "<b>Velocity Rush Ratio:</b> Monthly completion rate during final 6 months divided by monthly completion rate during prior 54 months."
            ],
            "rules": [
                "<b>March Fiscal Dumping:</b> Evaluated per MP/FY. Combined March Index mapped to severity: Index 30% (0.50), 45% (0.65), 65% (0.85), 85% (1.00). Normal baseline expectation is 8.3% per month.",
                "<b>Pre-Election Term Rush:</b> Evaluated per MP (requires >= 5 completed works in baseline). Rush Ratio mapped to severity: 2.0x (0.50), 3.5x (0.65), 5.0x (0.80), 10.0x (1.00).",
                "<b>Signal Amalgamation:</b> Final Severity = Max(March Severity, Term Rush Severity)."
            ],
            "severity": "Derived from the higher of the March Index or Rush Ratio severity curves. Filtered against SEVERITY_FLOOR.",
            "safeguards": "Uses a 60% expenditure weighting so that many minor works closed in March do not distort scores unless massive capital funds are concentrated simultaneously.",
            "workflow": [
                "Map completion dates to fiscal years and flag March completions.",
                "Calculate MP annual works %, spending %, and weighted composite March Index.",
                "Compute final 6-month monthly rate vs. prior 54-month baseline (min 5 works).",
                "Map severities for March dumping and term rush; select max severity.",
                "Store completion date, fiscal year, rush ratio, and March index in evidence."
            ],
            "example_desc": "An MP completes 10 works per year from 2019 to 2023.",
            "example_scenario": "In the 6 months preceding the 2024 general election, 48 works are suddenly certified as completed (8 works/month vs. 0.83 works/month baseline). Rush Ratio = 9.6x -> Triggers Pre-Election Rush with 0.98 Severity."
        },
        {
            "id": "Detector 08",
            "name": "Same-Day Bulk Completion (Daily Spike Forensics)",
            "method": "Statistical Process Control & Anomaly Spike Detection",
            "plain_summary": (
                "Detects administrative batch sign-offs where an implausibly large volume of distinct civil works are certified as completed "
                "on a single calendar day, indicating paper completions without genuine physical verification."
            ),
            "inputs": [
                "<b>District Dynamic Baseline:</b> Outlier-trimmed 95th percentile daily completion average and standard deviation.",
                "<b>Spike Ratio:</b> Total works completed on target date divided by normal daily district completion mean.",
                "<b>Date Sensitivity Markers:</b> Special scrutiny for March 25–30 (+0.10) and March 31 (+0.20 total).",
                "<b>Category Diversity Ratio:</b> Ratio of unique categories to total works on that date (< 0.20 indicates uniform batch processing).",
                "<b>MP Same-Day Concentration:</b> Dedicated check for parliamentarians closing >= 8 works on a single date."
            ],
            "rules": [
                "<b>District Event Threshold:</b> Daily works >= District Baseline (Mean + 3*StdDev, minimum floor of 10 works).",
                "<b>Spike Ratio Severity:</b> 10x normal (0.40), 20x (0.60), 50x (0.85), 100x (1.00).",
                "<b>Homogeneity Boost:</b> Unique Categories / Works < 0.20 adds +0.15 severity.",
                "<b>MP-Level Batch Scale:</b> 8 works (0.50), 15 works (0.70), 25 works (0.90). Composite = Max(District, MP).",
                "<b>False-Positive Mitigations:</b> Bulk supply/street light keywords ('street light', 'lamp', 'led', 'pole', 'supply of') reduce severity by 30% (0.70x). Standard quarter-ends reduced by 20% (0.80x)."
            ],
            "severity": "Max of district spike and MP batch severity, plus calendar and homogeneity boosts, discounted by supply and quarter-end buffers. Capped at 1.00.",
            "safeguards": "Supply-based contracts naturally delivered and installed in batches are shielded from false alarms via text keyword matching and quarter-end dampeners.",
            "workflow": [
                "Compute 95th percentile trimmed mean and StdDev of daily completions.",
                "Aggregate completions by District + Date; flag dates exceeding threshold.",
                "Compute Spike Ratio, March-end boosts, and category diversity ratio.",
                "Group completions by MP + Date; flag MPs with >= 8 completions.",
                "Apply supply keyword factor (0.70x) and quarter-end factor (0.80x).",
                "Persist evidence including spike ratio, date, and constituent work IDs."
            ],
            "example_desc": "A district normally completes 1 to 2 civil works per week.",
            "example_scenario": "On March 31, exactly 42 separate school repairs and community halls are certified completed on that single day. Spike Ratio > 30x + March 31 boost triggers an anomaly with 0.95 Severity."
        },
        {
            "id": "Detector 09",
            "name": "Round-Number Screen & Benford's Law Analysis",
            "method": "Forensic Number Analysis & Goodness-of-Fit Testing",
            "plain_summary": (
                "Identifies manufactured or fabricated budget allocations by checking whether project cost figures follow natural logarithmic digit distributions "
                "(Benford's Law) or exhibit abnormal clustering at exact round-number amounts."
            ),
            "inputs": [
                "<b>First Significant Digit (1–9):</b> Extracted from non-zero costs and compared against Benford's distribution (log10(1 + 1/d)).",
                "<b>Second Significant Digit (0–9):</b> Evaluated when sample sizes are sufficiently large (>= 60 works).",
                "<b>Roundness Level Classification:</b> Level 0 (not round), Level 1 (₹10k), Level 2 (₹50k), Level 3 (₹1L), Level 4 (₹5L), Level 5 (₹10L).",
                "<b>Multiple Testing Correction:</b> Bonferroni correction applied across MP portfolio Chi-Square tests."
            ],
            "rules": [
                "<b>Sample Size Guardrails:</b> Requires >= 45 works for 1st-digit Benford Chi-Square test; >= 60 works for 2nd-digit test. Below 45, Benford analysis is bypassed.",
                "<b>Benford Violation Criteria:</b> Adjusted p-value < 0.05 AND First-Digit Deviation > 0.15, OR Second-Digit adjusted p-value < 0.05.",
                "<b>Round-Number Concentration:</b> Portfolio % of works at Level >= 3 (₹1 Lakh+ multiples). Severity reference: 20% (0.50), 35% (0.70), 50% (0.90).",
                "<b>Work-Level Flagging:</b> Evaluated if project is Level >= 4 (exact ₹5L or ₹10L multiple) OR MP portfolio exhibits >= 30% exact-lakh concentration."
            ],
            "severity": "Base 0.50, +0.20 for Level 5 (exact ₹10L), compounded with MP portfolio roundness severity and Benford violation signal.",
            "safeguards": "A single round project is never flagged on its own; anomalies require corroboration from the parliamentarian's macro-portfolio distribution.",
            "workflow": [
                "Retain works with Cost > 0; extract 1st/2nd digits and roundness levels (0–5).",
                "Group by MP (>= 45 works); compute Chi-Square test against Benford probabilities.",
                "Compute % of MP works with roundness Level >= 3.",
                "Adjust p-values for family-wise error rate; flag Benford violations.",
                "Flag Level 4/5 works or works in >=30% round portfolios.",
                "Store digits, round level, Chi-Square statistic, p-value, and persist."
            ],
            "example_desc": "An MP portfolio contains 80 projects.",
            "example_scenario": "52 projects are budgeted at exactly ₹5,00,000 or ₹10,00,000 (65% round concentration). First-digit distribution completely fails Benford's Law (p < 0.001). Triggers an alert with 0.88 Severity."
        },
        {
            "id": "Detector 10",
            "name": "Vague Description Flag (Text Forensics)",
            "method": "Natural Language Engineering Detail & Specificity Scoring",
            "plain_summary": (
                "Screens project documentation to flag missing, excessively brief, boilerplate, or uninformative project scopes, "
                "enforcing the statutory principle that substantial public expenditure requires proportional engineering detail."
            ),
            "inputs": [
                "<b>Character Length Gates:</b> Tiered thresholds based on project capital commitment.",
                "<b>Generic Boilerplate Phrases:</b> Detection of uninformative phrases ('development work', 'various works', 'miscellaneous', 'other work').",
                "<b>5-Dimensional Specificity Score:</b> Weighted metrics for Measurements (0.25), Locations (0.25), Technical Specs (0.20), Scope Action (0.15), and Beneficiaries (0.15).",
                "<b>Corpus Template Repetition:</b> Tracks identical description strings occurring >= 10 times across unrelated works."
            ],
            "rules": [
                "<b>Critical Missing Description:</b> Empty, 'Not specified', 'None', or 'nan' immediately flagged with Critical severity (1.00).",
                "<b>Cost Exemption Floor:</b> Projects < ₹2,00,000 are completely exempt from normal vagueness screening.",
                "<b>High-Cost Length Rules (>= ₹5 Lakh):</b> Length < 25 chars -> Severity 0.85; 25–49 chars -> Severity 0.70.",
                "<b>Medium-Cost Length Rules (₹2L–₹5L):</b> Length < 20 chars -> Severity 0.75; 20–39 chars -> Severity 0.60.",
                "<b>Specificity Deficit:</b> Score < 0.12 triggers low_specificity (0.80); Score < 0.20 for >=₹5L triggers substandard_specificity (0.60).",
                "<b>Template Repetition:</b> Exact string repeated >= 10 times triggers template_repetition (0.50 to 0.85).",
                "<b>Signal Compounding:</b> Final Severity = Max(Individual Signals) + 0.15 * (Signal Count - 1), capped at 1.00."
            ],
            "severity": "Combines length, generic phrasing, low specificity, and template reuse, with missing descriptions receiving automatic 1.00.",
            "safeguards": "Small capital works (<₹2 Lakh) are exempted; standard engineering vocabulary (RCC, M20, chainage, village landmarks) directly boosts the specificity score.",
            "workflow": [
                "Flag missing descriptions with severity 1.00.",
                "Skip projects with Cost < ₹2,00,000.",
                "Assess character length against ₹5L and ₹2L thresholds.",
                "Search for generic phrases ('development work', 'various works').",
                "Calculate weighted specificity score across 5 engineering dimensions.",
                "Count exact matches across corpus; flag count >= 10.",
                "Merge signals (Max + 0.15 per additional), filter by floor, and persist."
            ],
            "example_desc": "A ₹20,00,000 project is entered with the description: 'Development work'.",
            "example_scenario": "Character length is 16 chars (< 25 chars for >= ₹5L -> 0.85), contains generic phrase 'development work', and has specificity score 0.04 (< 0.12). Compounded severity = 1.00 Critical."
        },
        {
            "id": "Detector 11",
            "name": "Category-Amount Mismatch (Engineering Plausibility)",
            "method": "Physical Engineering Plausibility Ceilings",
            "plain_summary": (
                "Screens project budgets against physical engineering plausibility limits to identify expenditures that are either "
                "implausibly exorbitant (e.g. ₹28 Lakh for a single handpump) or impossibly inadequate (e.g. ₹45,000 for an entire school building)."
            ),
            "inputs": [
                "<b>Engineering Feasibility Master:</b> Predefined minimum and maximum unit costs for 7 standard categories: School Building (₹5L–₹2Cr), Community Hall (₹3L–₹1.5Cr), Handpump (₹25k–₹1L), Overhead Tank (₹4L–₹30L), Compound Wall (₹50k–₹50L), Street Lights (₹3k–₹35k), CC Roads (₹50k–₹2.5Cr).",
                "<b>Master File Override:</b> Seamless override via unit_prices_master.csv when available.",
                "<b>Category Inference NLP:</b> Maps generic classifications ('Others') to verified categories via keyword parsing (e.g., 'borewell', 'LED light').",
                "<b>Quantity Extraction:</b> Parses quantity from description; defaults to 1 unit if unstated."
            ],
            "rules": [
                "<b>Feasible Range Bounds:</b> Effective Minimum = Unit Min x Quantity; Effective Maximum = Unit Max x Quantity.",
                "<b>Implausibly Low Check:</b> Actual Cost < Effective Minimum -> Flagged. Ratio = Min / Cost. Severity: 1.0x (0.50), 5.0x (0.85), 10.0x (1.00).",
                "<b>Implausibly High Check:</b> Actual Cost > Effective Maximum -> Flagged. Ratio = Cost / Max. Severity: 1.0x (0.50), 3.0x (0.80), 5.0x (1.00)."
            ],
            "severity": "Calculated monotonically from the deviation ratio outside permissible engineering bounds, capped at 1.00.",
            "safeguards": "Projects lacking recognizable category keywords are safely skipped rather than evaluated against arbitrary thresholds.",
            "workflow": [
                "Ingest default bounds and apply unit_prices_master.csv overrides if present.",
                "Normalize category from text keywords and extract quantity (default 1).",
                "Multiply unit min/max by quantity to establish project-level feasible envelope.",
                "Test if Cost < Effective Min (low) OR Cost > Effective Max (high).",
                "Compute deviation ratio and map to monotonic severity.",
                "Record deviation ratio, category, feasible bounds, and persist Anomaly record."
            ],
            "example_desc": "Category: Drinking Water - Handpump; Quantity: 1; Recorded Cost: ₹28,00,000.",
            "example_scenario": "Maximum feasible engineering cost for a handpump is ₹1,00,000. Ratio = ₹28L ÷ ₹1L = 28.0x. Triggers Implausibly High alert with maximum 1.00 Severity."
        },
        {
            "id": "Detector 12",
            "name": "Verification Gap Flag (Ledger Reconciliation)",
            "method": "Macro Ledger vs. Micro Project Reconciliation",
            "plain_summary": (
                "Reconciles bottom-up completed project expenditure against top-down MP-level official financial ledgers, "
                "identifying discrepancies between project claims and statutory accounts as well as severe disbursement deficits."
            ),
            "inputs": [
                "<b>Official Financial Ledger:</b> Ingests all_mps_financial_breakdown.csv containing official completed works value, allocation, and portfolio payment gap.",
                "<b>Database Project Aggregation:</b> Bottom-up summation of all completed project costs for each parliamentarian.",
                "<b>Divergence Ratio:</b> Bottom-up Database Project Sum divided by Official Ledger Completed Value.",
                "<b>Disbursement Deficit Triangulation:</b> Ratio of verified paid amount to project cost evaluated against macro portfolio payment gaps."
            ],
            "rules": [
                "<b>MP-Level Ledger Divergence:</b> Triggered when Database Project Sum exceeds Ledger Completed Value by > 15% (Divergence Ratio > 1.15). Severity scale: 1.15x (0.50), 1.50x (0.70), 2.50x (1.00). Attributed to all constituent works.",
                "<b>Work-Level Disbursement Deficit:</b> Triggered when: Verified payment record exists AND Disbursement Ratio < 25% AND MP Portfolio Payment Gap >= 60%. Severity scales with (1 - Disbursement Ratio).",
                "<b>Composite Selection:</b> Final Severity = Max(MP Divergence Severity, Work Deficit Severity)."
            ],
            "severity": "Takes the higher of the macro ledger divergence or micro disbursement deficit severity. Filtered by SEVERITY_FLOOR.",
            "safeguards": "Missing payment records are never treated as ₹0 paid, preventing data-pipeline ingestion delays from being misidentified as accounting fraud.",
            "workflow": [
                "Load MP financial breakdown schedule into lookup map.",
                "Aggregate costs of completed works per MP in the database.",
                "If Database Sum / Ledger Value > 1.15, compute MP divergence severity.",
                "For each completed work, check payment existence, disbursement ratio (<25%), and MP gap (>=60%).",
                "Take Max(Divergence, Deficit) severity.",
                "Persist verification gap anomaly with divergence ratio, ledger values, and disbursement metrics."
            ],
            "example_desc": "An MP's database entries show ₹14.5 Crore of completed projects.",
            "example_scenario": "The official verified financial ledger records only ₹8.0 Crore of completed works. Divergence Ratio = 1.81x (> 1.15x threshold) -> Triggers Verification Gap with 0.81 Severity across constituent works."
        },
        {
            "id": "Detector 13",
            "name": "Implementing District Authority (IDA) Risk Profiler",
            "method": "Hierarchical Empirical Bayes Entity Risk Aggregator",
            "plain_summary": (
                "Aggregates project-level anomaly signals across all detectors to compute a unified, statistically robust "
                "composite risk score and relative percentile tier for each Implementing District Authority (IDA)."
            ),
            "inputs": [
                "<b>Cross-Detector Anomaly Synthesis:</b> Ingests anomaly outputs from Detectors 1 through 12 for the current run.",
                "<b>Unique Flagged Project Rate:</b> Unique flagged works divided by total district works (prevents double-counting).",
                "<b>Weighted Detector Violations:</b> Incorporates detector-specific violation rates, mean severities, and configured weights.",
                "<b>Empirical Bayes Shrinkage (m=30):</b> Adjusts district scores toward the national mean to stabilize small-sample districts."
            ],
            "rules": [
                "<b>Raw Risk Score Formula:</b> Sum of (Violation Rate x 100 x Mean Severity x Detector Weight) across all detectors, capped at 100.",
                "<b>Empirical Bayes Shrinkage Formula:</b> Shrunk Risk = Raw Risk * [N / (N + 30)] + National Mean * [30 / (N + 30)], where N is total district works.",
                "<b>Relative Percentile Tiers:</b> Top 10% of districts by shrunk risk -> Critical; Next 20% (10%–30%) -> High; Next 30% (30%–60%) -> Medium; Remaining 40% -> Clean."
            ],
            "severity": "Continuous composite score (0–100) representing shrunk systemic risk, converted into relative administrative tiers.",
            "safeguards": "Empirical Bayes shrinkage prevents small districts with few projects from artificially dominating the Critical tier due to high raw percentages.",
            "workflow": [
                "Left-join works and anomalies for the active run ID.",
                "Compute total works, total expenditure, and unique flagged works per district.",
                "For each detector, compute violation rate, mean severity, and weighted contribution.",
                "Calculate weighted raw risk score (capped at 100).",
                "Calculate national mean risk and apply m=30 shrinkage formula.",
                "Rank districts descending by shrunk risk; assign Critical, High, Medium, or Clean tiers.",
                "Store EntityRisk record (entity_type='ida') with detailed detector breakdown JSON."
            ],
            "example_desc": "District A has 200 projects, 45 of which trigger various detectors (overruns, ghost works, delays).",
            "example_scenario": "Its weighted raw score is 68.2. Because N=200 is large, shrinkage is minimal (weight 200/230 = 87% on raw score). Shrunk risk = 64.5, placing District A in the Top 10% Critical tier for targeted audit."
        },
        {
            "id": "Detector 14",
            "name": "MP & Constituency Risk Profiler",
            "method": "Hierarchical Empirical Bayes Portfolio Risk Aggregator",
            "plain_summary": (
                "Synthesizes anomaly results across an entire parliamentarian's project portfolio, evaluating the breadth, frequency, "
                "and severity of irregular patterns to establish an executive risk index and comparative ranking."
            ),
            "inputs": [
                "<b>Constituency & MP Binding:</b> Maps all recommended works to the sponsoring MP and constituency.",
                "<b>Multi-Signal Portfolio Profiling:</b> Integrates duplicate works, cost overruns, smurfing, delays, Benford violations, and timing anomalies.",
                "<b>Weighted Portfolio Score:</b> Incorporates detector-specific violation frequencies, average severities, and configured weights.",
                "<b>Empirical Bayes Shrinkage (m=20):</b> Stabilizes risk scores for parliamentarians with small numbers of recommended works."
            ],
            "rules": [
                "<b>Raw Portfolio Score:</b> Sum of (Violation Rate x 100 x Mean Severity x Detector Weight), capped at 100.",
                "<b>Empirical Bayes Formula:</b> Shrunk Risk = Raw Risk * [N / (N + 20)] + National MP Mean * [20 / (N + 20)], where N is total MP works.",
                "<b>Relative Percentile Tiers:</b> Top 10% of MPs by shrunk risk -> Critical; Next 20% (10%–30%) -> High; Next 30% (30%–60%) -> Medium; Remaining 40% -> Clean."
            ],
            "severity": "Composite score (0–100) scaled via Empirical Bayes shrinkage, mapped to relative percentile tiers.",
            "safeguards": "Small portfolios (e.g. newly elected MPs with < 10 works) are prevented from receiving distorted Critical ratings via m=20 shrinkage.",
            "workflow": [
                "Merge work records and active run anomalies by work_id.",
                "Group records by MP name; calculate total works, expenditure, and unique flagged works.",
                "Calculate violation rates, mean severities, and weighted scores per detector.",
                "Sum detector contributions into raw score and cap at 100.",
                "Compute national MP average and apply m=20 shrinkage formula.",
                "Rank MPs descending by shrunk risk; assign Critical/High/Medium/Clean tiers.",
                "Save EntityRisk record (entity_type='mp') with constituency and detector breakdown."
            ],
            "example_desc": "An MP recommends 120 projects. 35 are flagged across smurfing, vague descriptions, and round-number screen.",
            "example_scenario": "Weighted raw risk = 58.4. Shrunk score = 54.1, placing this MP in the 88th percentile (High Risk tier), warranting portfolio-level review."
        },
        {
            "id": "Detector 15",
            "name": "Copy-Paste Pricing (Cloned Estimates Forensics)",
            "method": "Combinatorial Pricing & Template Replication Analysis",
            "plain_summary": (
                "Identifies cloned, copy-pasted, or template budgeting where unrelated projects under the same MP share identical "
                "total project costs across different categories, or share identical rounded unit rates within the same category."
            ),
            "inputs": [
                "<b>Cross-Category Cost Clustering:</b> Groups works by MP + Exact Rounded Cost across multiple distinct categories.",
                "<b>High-Confidence Unit Rate Extraction:</b> Reuses NLP parsing to compute unit rate (Cost / Quantity) with high confidence.",
                "<b>Unit Rate Rounding:</b> Rounds calculated unit rates to the nearest ₹100 to catch clustered estimates.",
                "<b>Category-Specific Unit Rate Clustering:</b> Evaluates repeated unit pricing within the same MP and category."
            ],
            "rules": [
                "<b>Signal 1 (Cross-Category Exact Cost Clone):</b> Triggered when >= 5 works under the same MP share the exact same cost AND span > 1 category. Severity scale: 5 works (0.75), 10 works (0.88), 20 works (0.98).",
                "<b>Signal 2 (Cloned Unit Rate):</b> Triggered when >= 5 works under the same MP and category share the identical rounded unit rate (to nearest ₹100) with high extraction confidence. Severity scale: 5 repeats (0.50), 10 repeats (0.70), 20 repeats (0.90).",
                "<b>Composite Selection:</b> Final Severity = Max(Cross-Category Severity, Cloned Unit Rate Severity)."
            ],
            "severity": "Derived from the higher of the cross-category or unit-rate repetition severity curves. Filtered by SEVERITY_FLOOR.",
            "safeguards": "Single-category identical costs (e.g. 5 identical road segments) do not trigger cross-category alerts; unit-rate checks strictly require high-confidence text extraction.",
            "workflow": [
                "Group works by MP + Cost; flag groups with >= 5 works and > 1 category.",
                "Extract benchmark type, unit type, and quantity (filter for high confidence).",
                "Compute Cost / Quantity; round to nearest ₹100.",
                "Group by MP + Category + Rounded Unit Rate; flag groups with >= 5 works.",
                "For each work, check cross-category clone and cloned unit rate; select max severity.",
                "Store exact repeat count, unit rate, category count, and persist Anomaly record."
            ],
            "example_desc": "An MP has 6 projects budgeted at exactly ₹10,00,000:",
            "example_scenario": "1 Road, 1 School, 1 Water project, 1 Lighting project, 1 Community Hall, and 1 Drainage work.\nBecause there are >= 5 works with identical cost across > 1 category, Signal 1 triggers with 0.75 Severity for possible boilerplate budgeting."
        }
    ]

    for det in detectors:
        card_content = []
        card_content.append(Paragraph(f"{det['id']}: {det['name']}", h1_style))
        card_content.append(Paragraph(f"<b>Methodology:</b> {det['method']}", tag_style))
        
        # 1. Plain English
        card_content.append(Paragraph("1. What is this detector in plain English?", h2_style))
        card_content.append(Paragraph(det['plain_summary'], body_style))

        # 2. What it checks
        card_content.append(Paragraph("2. What data and features does it check?", h2_style))
        for inp in det['inputs']:
            card_content.append(Paragraph(f"• {inp}", bullet_style))

        # 3. How does it detect issues
        card_content.append(Paragraph("3. How does it detect issues? (Rules & Thresholds)", h2_style))
        for rule in det['rules']:
            card_content.append(Paragraph(f"• {rule}", bullet_style))

        # 4. Severity & Alert Levels
        card_content.append(Paragraph("4. Severity & Alert Levels", h2_style))
        card_content.append(Paragraph(det['severity'], body_style))

        # 5. False-Positive Safeguards
        card_content.append(Paragraph("5. False-Positive Safeguards (When is it NOT fraud?)", h2_style))
        card_content.append(Paragraph(det['safeguards'], body_style))

        # 6. Step-by-Step Flow
        card_content.append(Paragraph("6. Step-by-Step Algorithm Flow", h2_style))
        for idx, step in enumerate(det['workflow'], 1):
            card_content.append(Paragraph(f"{idx}. {step}", number_style))

        # 7. Real-World Example Box
        card_content.append(Paragraph("7. Simple Real-World Example", h2_style))
        ex_text = f"<i>{det['example_desc']}</i><br/>{det['example_scenario'].replace(chr(10), '<br/>')}"
        
        ex_table = Table([[Paragraph(ex_text, example_box_style)]], colWidths=[504])
        ex_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LINELEFT', (0, 0), (0, 0), 2.5, colors.HexColor("#2563EB")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ]))
        card_content.append(ex_table)
        card_content.append(Spacer(1, 14))

        story.extend(card_content)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully built: {output_filename}")


if __name__ == "__main__":
    downloads_pdf = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Guide.pdf"
    spec_pdf = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Specification.pdf"
    local_pdf = "/Users/suvendu/Downloads/SIH-DATA/SATARK_MPLADS_15_Detectors_Guide.pdf"

    build_pdf(downloads_pdf)
    build_pdf(spec_pdf)
    build_pdf(local_pdf)
