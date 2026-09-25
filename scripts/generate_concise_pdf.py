#!/usr/bin/env python3
"""
Generates a concise, clean, professional PDF document covering all 15 SATARK MPLADS Fraud & Anomaly Detectors.
Fixes:
- Completely removes non-ASCII characters (Rs. instead of Rupee symbol, standard dashes, / instead of division symbol)
  to ensure zero black boxes or missing glyph squares in any PDF reader.
- xml_safe helper guarantees that <, >, & in sentences are properly escaped so ReportLab's parser never breaks.
- Compact, high-density executive layout (aiming for ~4-5 pages total instead of 15 sprawling pages).
- Clean, standard typography, clear borders, dynamic page numbers (Page X of Y).
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

def xml_safe(text: str) -> str:
    """Escapes XML entities in text while preserving <b>, </b>, <i>, </i> tags."""
    if not isinstance(text, str):
        text = str(text)
    text = text.replace('<b>', '___B_OPEN___').replace('</b>', '___B_CLOSE___')
    text = text.replace('<i>', '___I_OPEN___').replace('</i>', '___I_CLOSE___')
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace('___B_OPEN___', '<b>').replace('___B_CLOSE___', '</b>')
    text = text.replace('___I_OPEN___', '<i>').replace('___I_CLOSE___', '</i>')
    return text

def p(text: str, style):
    """Helper to return a Paragraph with xml_safe applied."""
    return Paragraph(xml_safe(text), style)

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas for dynamic 'Page X of Y' and header."""
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
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(50, 11 * 72 - 32, "SATARK MPLADS Intelligence Portal - 15 Detectors Concise Reference")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(50, 11 * 72 - 36, 8.5 * 72 - 50, 11 * 72 - 36)
            
        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 50, 26, page_str)
        self.drawString(50, 26, "CONFIDENTIAL - AUDIT & VIGILANCE FORENSIC SPECIFICATION")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(50, 36, 8.5 * 72 - 50, 36)
        
        self.restoreState()


def build_concise_pdf(output_filename: str):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        leftMargin=50,
        rightMargin=50,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=2
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#475569"),
        spaceAfter=6
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    det_title_style = ParagraphStyle(
        'DetTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0F172A"),
        keepWithNext=True
    )

    det_method_style = ParagraphStyle(
        'DetMethod',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#2563EB"),
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=2
    )

    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#334155"),
        leftIndent=10,
        firstLineIndent=-6,
        spaceAfter=1
    )

    tbl_hdr_style = ParagraphStyle(
        'TblHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white
    )

    tbl_cell_style = ParagraphStyle(
        'TblCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#1E293B")
    )

    tbl_cell_bold = ParagraphStyle(
        'TblCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # Title & Subtitle
    story.append(p("SATARK MPLADS Intelligence Portal", title_style))
    story.append(p("Executive Quick-Reference: 15 Anomaly & Fraud Detectors", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1E3A8A"), spaceBefore=0, spaceAfter=5))

    intro_p = (
        "<b>Investigative Context:</b> SATARK evaluates public works across 15 analytical dimensions "
        "covering machine learning, semantic NLP, statutory engineering benchmarks (CPWD DSR), "
        "Benford's Law, and ledger reconciliation. Anomalies serve as objective screening leads for physical inspection, "
        "never unilateral accusations. All monetary values are expressed in Indian Rupees (Rs.)."
    )
    story.append(p(intro_p, body_style))
    story.append(Spacer(1, 2))

    # Master Table
    story.append(p("Master Detector Matrix", h1_style))

    summary_data = [
        [
            p("ID", tbl_hdr_style),
            p("Detector Name", tbl_hdr_style),
            p("Core Methodology", tbl_hdr_style),
            p("Primary Trigger / Threshold", tbl_hdr_style)
        ],
        [
            p("D-01", tbl_cell_bold),
            p("Unusual Pattern Detection", tbl_cell_bold),
            p("Isolation Forest (6 features)", tbl_cell_style),
            p("Multi-dimensional outlier across cost, duration, and days/lakh (min 50 works).", tbl_cell_style)
        ],
        [
            p("D-02", tbl_cell_bold),
            p("Duplicate Work Detection", tbl_cell_bold),
            p("Sentence Transformer + Union-Find", tbl_cell_style),
            p("Cosine similarity >= 0.95, or >= 0.93 + same Category + Cost ratio 70%-143% in district.", tbl_cell_style)
        ],
        [
            p("D-03", tbl_cell_bold),
            p("Cost Overrun Detection", tbl_cell_bold),
            p("CPWD DSR 2023 Benchmarks", tbl_cell_style),
            p("Unit rate exceeds ceiling (with 6% p.a. inflation + 15% terrain) by >= 5% and >= Rs. 10k.", tbl_cell_style)
        ],
        [
            p("D-04", tbl_cell_bold),
            p("Ghost Works Detection", tbl_cell_bold),
            p("Disbursement vs Status Audit", tbl_cell_style),
            p("Status 'completed' but verified payment is Rs. 0 or < 50% paid; 30-day grace for recent works.", tbl_cell_style)
        ],
        [
            p("D-05", tbl_cell_bold),
            p("Bill Splitting (Smurfing)", tbl_cell_bold),
            p("Procurement Band Clustering", tbl_cell_style),
            p(">= 3 works in Rs. 4.5L-<5L band OR >= 2 works in Rs. 18L-<20L band in same month by same MP.", tbl_cell_style)
        ],
        [
            p("D-06", tbl_cell_bold),
            p("Delays & Stalled Works", tbl_cell_bold),
            p("Statutory 365-Day Timeline", tbl_cell_style),
            p("Active work stalled > 365 days, or completed with extreme delay. Multi-phase capped at 0.69.", tbl_cell_style)
        ],
        [
            p("D-07", tbl_cell_bold),
            p("Suspicious Timing Forensics", tbl_cell_bold),
            p("Fiscal Concentration & Velocity", tbl_cell_style),
            p("March Index (40% count + 60% spend) >= 30%, or pre-election velocity surge >= 2.0x.", tbl_cell_style)
        ],
        [
            p("D-08", tbl_cell_bold),
            p("Same-Day Bulk Completion", tbl_cell_bold),
            p("Trimmed Baseline + 3-Sigma Spike", tbl_cell_style),
            p("Completions >= Mean + 3*StdDev (floor 10) on 1 day, or MP closes >= 8 works. Supply dampener.", tbl_cell_style)
        ],
        [
            p("D-09", tbl_cell_bold),
            p("Round-Number & Benford", tbl_cell_bold),
            p("Chi-Square Test & Lakh Multiples", tbl_cell_style),
            p("Benford 1st/2nd digit p < 0.05 (min 45 works), or >= 30% works at exact Rs. 1L/5L/10L multiples.", tbl_cell_style)
        ],
        [
            p("D-10", tbl_cell_bold),
            p("Vague Description Flag", tbl_cell_bold),
            p("5-Tier NLP Specificity Scoring", tbl_cell_style),
            p("Length < 25 chars for >= Rs. 5L, generic phrases ('development work'), or template reuse >= 10x.", tbl_cell_style)
        ],
        [
            p("D-11", tbl_cell_bold),
            p("Category-Amount Mismatch", tbl_cell_bold),
            p("Engineering Feasibility Bounds", tbl_cell_style),
            p("Cost implausibly high (e.g. > Rs. 1L for handpump) or low (< Rs. 5L for school building).", tbl_cell_style)
        ],
        [
            p("D-12", tbl_cell_bold),
            p("Verification Gap Flag", tbl_cell_bold),
            p("Macro vs Micro Reconciliation", tbl_cell_style),
            p("Database sum of completed works exceeds official MP ledger by > 15% (divergence > 1.15).", tbl_cell_style)
        ],
        [
            p("D-13", tbl_cell_bold),
            p("IDA Risk Profiler", tbl_cell_bold),
            p("Empirical Bayes Shrinkage (m=30)", tbl_cell_style),
            p("Aggregates D-01 to D-12 for districts; shrunk toward national mean. Top 10% ranked Critical.", tbl_cell_style)
        ],
        [
            p("D-14", tbl_cell_bold),
            p("MP & Constituency Profiler", tbl_cell_bold),
            p("Empirical Bayes Shrinkage (m=20)", tbl_cell_style),
            p("Aggregates all works per MP portfolio; shrunk toward national mean. Top 10% ranked Critical.", tbl_cell_style)
        ],
        [
            p("D-15", tbl_cell_bold),
            p("Copy-Paste Pricing", tbl_cell_bold),
            p("Cloned Estimates Forensics", tbl_cell_style),
            p("Same MP has >= 5 works with exact same cost across categories, or >= 5 identical unit rates.", tbl_cell_style)
        ]
    ]

    # Available printable width: 8.5 * 72 - 100 = 512 pt
    col_widths = [24, 115, 125, 248]
    t_summary = Table(summary_data, colWidths=col_widths, repeatRows=1)
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))

    story.append(t_summary)
    story.append(PageBreak())

    # ========================== DETAILED DETECTOR CARDS ==========================
    detectors = [
        {
            "id": "Detector 01",
            "name": "Unusual Pattern Detection",
            "method": "Machine Learning Outlier Detection (Isolation Forest)",
            "summary": "Analyzes the multidimensional configuration of every project (cost, duration, completion timing, and cost deviations) to spot extreme statistical anomalies relative to peer works in the same district and category.",
            "rules": [
                "<b>Features (6):</b> Log(Cost), Elapsed Days, Completion Month (1-12), Category Median Cost Delta %, District Median Cost Delta %, and Days per Lakh Spent.",
                "<b>Guardrails:</b> Requires at least 50 valid completed works in the database; excludes malformed dates.",
                "<b>Scoring:</b> Isolation Forest anomaly score mapped monotonically to severity (0.30 to 1.00).",
                "<b>Safeguard:</b> Outliers indicate statistical rarity (e.g. specialized foundation or flood relief), not direct fraud."
            ],
            "example": "A community hall in District X takes 9 days and Rs. 48 Lakh (normal baseline: 180-240 days for Rs. 12L-15L). Flagged with high severity for abnormal cost-time combination."
        },
        {
            "id": "Detector 02",
            "name": "Duplicate Work Detection",
            "method": "Natural Language Processing (Sentence Transformers) & Union-Find",
            "summary": "Identifies potential double-billing where multiple project descriptions describe essentially the same physical asset in the same district despite variations in wording or phrasing.",
            "rules": [
                "<b>Filters:</b> Descriptions < 20 characters discarded; boilerplate phrases occurring > 10 times excluded.",
                "<b>District Partitioning:</b> Pairwise semantic comparisons are strictly restricted within the same district.",
                "<b>Thresholds:</b> Cosine similarity >= 0.95 triggers High Confidence; similarity >= 0.93 + identical Category + Cost within 70%-143% also triggers. Borderline pairs (0.88-0.93) route to a human review queue.",
                "<b>Clustering:</b> Union-Find groups connected pairs into clusters (size 2-10). +0.10 severity boost if recommended by the exact same MP."
            ],
            "example": "'Construction of 200m CC road near Shiva Mandir Ward 4' (Rs. 8.0L) vs. 'CC road 200m adjacent to Shiva temple Ward No 4' (Rs. 7.95L). Similarity = 0.96 -> Flagged as duplicate cluster."
        },
        {
            "id": "Detector 03",
            "name": "Cost Overrun Detection",
            "method": "Statutory Schedule of Rates (CPWD DSR 2023 Benchmarks)",
            "summary": "Validates project invoices against official Central Public Works Department (CPWD DSR 2023) rate ceilings, adjusted for compounding inflation and difficult terrain.",
            "rules": [
                "<b>Ceiling Formula:</b> Max Allowed Rate = Base CPWD Rate x (1 + 0.06)^(Years post-2023) x (1 + 0.25 Base Buffer + 0.15 Terrain Buffer).",
                "<b>Overrun Trigger:</b> Unit rate must exceed ceiling by >= 5.0% AND estimated excess spend must be >= Rs. 10,000.",
                "<b>Severity Scale:</b> 5% excess (0.30), 25% excess (0.50), 50% excess (0.75), >= 100% excess (1.00).",
                "<b>Safeguard:</b> Projects in classified hill/remote districts automatically receive +15% tolerance allowance."
            ],
            "example": "A 100m CC road billed at Rs. 9,00,000 (Rs. 9,000/m) in 2024 against an escalated CPWD ceiling of Rs. 4,650/m. Overrun is +93.5% with Rs. 4.35L excess -> Flagged with 0.95 Severity."
        },
        {
            "id": "Detector 04",
            "name": "Ghost Works Detection",
            "method": "Disbursement Audit & Financial Ledger Reconciliation",
            "summary": "Identifies projects certified as completed on paper but lacking corroborating financial disbursement records in verified accounting ledgers.",
            "rules": [
                "<b>Target:</b> Evaluates exclusively works marked with status = 'completed'.",
                "<b>Signal 1 (Zero Payment):</b> Confirmed payment ledger exists, project marked completed, but total paid is Rs. 0 (Base Severity: 0.80).",
                "<b>Signal 2 (Underpayment):</b> Confirmed payment ledger exists, but paid amount < 50% of claimed cost.",
                "<b>Signal 3 (MP Context):</b> MP portfolio has >= 40% aggregate unverified payment gap across completed works.",
                "<b>Safeguards:</b> Missing payment record is NOT assumed to be Rs. 0 (treated as unknown). 30-day grace period (0.60x) for recently completed works; works < Rs. 50k scaled by 0.80x."
            ],
            "example": "A Rs. 25 Lakh community centre marked 'completed' 6 months ago shows Rs. 0 disbursed in the official payment ledger. Triggers Ghost Work alert with 0.90 Severity."
        },
        {
            "id": "Detector 05",
            "name": "Bill Splitting / Smurfing",
            "method": "Contract Value Distribution & Procurement Threshold Analysis",
            "summary": "Catches deliberate splitting of large capital works into smaller contracts priced just below mandatory tender or technical sanction thresholds (Rs. 5 Lakh and Rs. 20 Lakh caps).",
            "rules": [
                "<b>Rs. 5L Band (Rs. 4.5L - <Rs. 5L):</b> 3 to 4 works in same month by same MP -> 0.60 severity; >= 5 works -> 0.80 severity. (Fewer than 3 ignored).",
                "<b>Rs. 20L Band (Rs. 18L - <Rs. 20L):</b> >= 2 works in same month by same MP AND cumulative sum >= Rs. 20 Lakh -> 0.70 severity.",
                "<b>Category Boost:</b> If all works in cluster share identical category, add +0.10 severity boost.",
                "<b>Safeguard:</b> Isolated sub-threshold contracts or works across different months are not flagged."
            ],
            "example": "An MP sanctions 4 road works in October 2023 priced at Rs. 4.90L, Rs. 4.95L, Rs. 4.85L, and Rs. 4.90L (Total Rs. 19.6L). Flagged for bypassing open tender limits with 0.70 Severity."
        },
        {
            "id": "Detector 06",
            "name": "Delays & Stalled Works",
            "method": "Timeline Forensics & Statutory 365-Day Deadline Enforcement",
            "summary": "Catches ongoing public works stalled past the statutory 1-year (365-day) completion guideline, as well as finished works that suffered extreme unapproved delays.",
            "rules": [
                "<b>Stalled In-Progress:</b> Active works past 365 days. Severity: 365 days (0.50), 548 days (0.65), 730 days (0.80), 1095 days / 3+ yrs (1.00).",
                "<b>Completed Delayed:</b> Finished works taking > 365 days. Severity: 365 days (0.30), 548 days (0.45), 730 days (0.60), 1095 days (0.80).",
                "<b>Multi-Phase Safeguard:</b> Descriptions with keywords ('phase', 'stage', 'part', 'package') receive 20% discount (0.80x) and hard cap at 0.69 (preventing Critical tier classification)."
            ],
            "example": "A drinking water pipeline sanctioned in Jan 2021 remains incomplete after 1,000+ days (>635 days overdue). Triggers Stalled Work alert with 0.95 Severity."
        },
        {
            "id": "Detector 07",
            "name": "Suspicious Timing Forensics",
            "method": "Fiscal Year-End Dumping & Pre-Election Velocity Forensics",
            "summary": "Identifies artificial project completions and expenditure surges driven by accounting deadlines (March fiscal dumping) or political electoral cycles (pre-election rush).",
            "rules": [
                "<b>Signal 1 (March Fiscal Dumping):</b> March Index = 40% * (March Works %) + 60% * (March Spend %). Mapped to severity: Index 30% (0.50), 45% (0.65), 65% (0.85), 85% (1.00). (Baseline is 8.3%/mo).",
                "<b>Signal 2 (Pre-Election Term Rush):</b> Completion rate in final 6 months of Lok Sabha term divided by rate in prior 54 months (min 5 baseline works). Severity: 2.0x (0.50), 3.5x (0.65), 5.0x (0.80), 10.0x (1.00).",
                "<b>Combination:</b> Final Severity = Max(March Severity, Term Rush Severity)."
            ],
            "example": "An MP completes 10 works/year from 2019-2023, but suddenly certifies 48 works in the 6 months before the 2024 election (Rush Ratio = 9.6x). Triggers Pre-Election Rush with 0.98 Severity."
        },
        {
            "id": "Detector 08",
            "name": "Same-Day Bulk Completion",
            "method": "Statistical Process Control & Daily Spike Forensics",
            "summary": "Detects administrative batch sign-offs where an implausibly large volume of civil works are certified completed on a single day, indicating paperwork sign-offs without on-site inspection.",
            "rules": [
                "<b>District Threshold:</b> Daily completions >= Mean + 3*StdDev (calculated from 95th-percentile trimmed baseline; minimum floor of 10 works).",
                "<b>Spike Ratio Scale:</b> 10x normal (0.40), 20x (0.60), 50x (0.85), 100x (1.00).",
                "<b>Boosts:</b> March 25-30 (+0.10), March 31 (+0.20), Category Diversity < 20% (+0.15).",
                "<b>MP Check:</b> Dedicated check for single MP closing >= 8 works on one date (8 works -> 0.50, 15 -> 0.70, 25 -> 0.90).",
                "<b>Safeguards:</b> Bulk supply keywords ('street light', 'lamp', 'led', 'pole', 'supply of') reduce severity by 30% (0.70x). Quarter-ends reduced by 20% (0.80x)."
            ],
            "example": "A district with a baseline of 1-2 works/week signs off on 42 school repairs on March 31. Spike ratio > 30x + March 31 boost triggers an anomaly with 0.95 Severity."
        },
        {
            "id": "Detector 09",
            "name": "Round-Number Screen & Benford's Law",
            "method": "Forensic Digit Distribution & Fabricated Budget Screening",
            "summary": "Checks whether project cost numbers follow natural statistical digit distributions (Benford's Law) or exhibit abnormal clustering at exact round-number amounts (multiples of Rs. 1L, 5L, 10L).",
            "rules": [
                "<b>Sample Size Guardrails:</b> Requires >= 45 works for 1st-digit Benford Chi-Square test; >= 60 works for 2nd-digit test. Smaller portfolios are bypassed.",
                "<b>Benford Violation:</b> Bonferroni-adjusted p-value < 0.05 AND First-Digit Deviation > 0.15.",
                "<b>Roundness Levels:</b> L1 (10k), L2 (50k), L3 (1L), L4 (5L), L5 (10L). Flags if portfolio has >= 30% works at Level >= 3 (multiples of Rs. 1 Lakh).",
                "<b>Work-Level Flagging:</b> Evaluated if individual project is Level >= 4 (exact Rs. 5L/10L) OR inside a >= 30% round portfolio."
            ],
            "example": "An MP with 80 projects budgets 52 of them at exactly Rs. 5,00,000 or Rs. 10,00,000 (65% concentration). 1st-digit Chi-Square test rejects Benford's Law (p < 0.001) -> Flagged with 0.88 Severity."
        },
        {
            "id": "Detector 10",
            "name": "Vague Description Flag",
            "method": "Natural Language Engineering Detail & Specificity Scoring",
            "summary": "Flags project records with missing, excessively brief, generic boilerplate, or uninformative scopes of work. Significant capital expenditure requires proportional engineering detail.",
            "rules": [
                "<b>Missing Description:</b> Empty, 'None', 'Not specified', or 'nan' immediately receives Critical 1.00 severity.",
                "<b>Exemption Floor:</b> Projects < Rs. 2,00,000 are completely exempt from vagueness checks.",
                "<b>Length Gates:</b> For >= Rs. 5L: < 25 chars -> 0.85; 25-49 chars -> 0.70. For Rs. 2L-5L: < 20 chars -> 0.75; 20-39 chars -> 0.60.",
                "<b>5-Tier Specificity Score:</b> Evaluates Measurements (0.25), Locations (0.25), Tech Specs (0.20), Action Verb (0.15), Beneficiary (0.15). Score < 0.12 triggers low_specificity (0.80).",
                "<b>Template Repetition:</b> Exact string occurring >= 10 times across corpus triggers 0.50-0.85 severity."
            ],
            "example": "A Rs. 20 Lakh work described only as 'Development work' (16 characters, specificity score 0.04) triggers length, generic phrase, and low specificity rules -> 1.00 Critical Severity."
        },
        {
            "id": "Detector 11",
            "name": "Category-Amount Mismatch",
            "method": "Physical Engineering Plausibility Ceilings & Unit Bounds",
            "summary": "Screens project budgets against physical engineering plausibility limits to identify expenditures that are implausibly exorbitant (e.g. Rs. 28L for 1 handpump) or impossibly inadequate (e.g. Rs. 45k for a school).",
            "rules": [
                "<b>Standard Unit Bounds:</b> School Building (Rs. 5L-2Cr), Community Hall (Rs. 3L-1.5Cr), Handpump (Rs. 25k-1L), Overhead Tank (Rs. 4L-30L), Compound Wall (Rs. 50k-50L), Street Lights (Rs. 3k-35k), CC Road (Rs. 50k-2.5Cr).",
                "<b>Quantity Scaling:</b> Effective Bounds = Unit Min/Max x Parsed Quantity (defaults to 1 unit if unstated).",
                "<b>Implausibly High:</b> Cost > Effective Max. Ratio = Cost / Max. Severity: 1.0x (0.50), 3.0x (0.80), 5.0x (1.00).",
                "<b>Implausibly Low:</b> Cost < Effective Min. Ratio = Min / Cost. Severity: 1.0x (0.50), 5.0x (0.85), 10.0x (1.00)."
            ],
            "example": "Category: Handpump; Quantity: 1; Recorded Cost: Rs. 28,00,000 (Maximum engineering limit: Rs. 1,00,000). Deviation ratio = 28.0x -> Triggers Implausibly High alert with 1.00 Severity."
        },
        {
            "id": "Detector 12",
            "name": "Verification Gap Flag",
            "method": "Macro Ledger vs. Micro Project Reconciliation",
            "summary": "Reconciles bottom-up completed project expenditure against top-down MP-level official financial ledgers, spotting discrepancies where claimed projects exceed official ledgers or have severe payment deficits.",
            "rules": [
                "<b>Macro Ledger Divergence:</b> Triggered when Database Project Sum exceeds Official Ledger Completed Value by > 15% (Divergence Ratio > 1.15). Severity: 1.15x (0.50), 1.50x (0.70), 2.50x (1.00). Attributed to all constituent works.",
                "<b>Micro Disbursement Deficit:</b> Triggered when: Verified payment record exists AND Disbursement Ratio < 25% AND MP Portfolio Payment Gap >= 60%. Severity scales with (1 - Disbursement Ratio).",
                "<b>Combination:</b> Final Severity = Max(Macro Divergence Severity, Micro Deficit Severity).",
                "<b>Safeguard:</b> Missing payment records are never treated as Rs. 0 paid, preventing pipeline ingestion delays from triggering false fraud alerts."
            ],
            "example": "An MP's database shows Rs. 14.5 Crore of completed projects, while the official ledger records only Rs. 8.0 Crore. Divergence Ratio = 1.81x (>1.15 threshold) -> Triggers Verification Gap with 0.81 Severity."
        },
        {
            "id": "Detector 13",
            "name": "IDA Risk Profiler",
            "method": "Hierarchical Empirical Bayes Entity Risk Aggregator",
            "summary": "Aggregates project-level anomaly signals across all detectors to compute a single, statistically robust composite risk score and relative percentile tier for each Implementing District Authority (IDA).",
            "rules": [
                "<b>Raw Risk Score:</b> Sum of (Violation Rate x 100 x Mean Severity x Detector Weight) across Detectors 1-12, capped at 100.",
                "<b>Empirical Bayes Shrinkage (m=30):</b> Shrunk Risk = Raw Risk * [N / (N + 30)] + National Mean * [30 / (N + 30)], where N is total district works.",
                "<b>Percentile Tiers:</b> Top 10% of districts by shrunk risk -> Critical; Next 20% (10%-30%) -> High; Next 30% (30%-60%) -> Medium; Remaining 40% -> Clean.",
                "<b>Safeguard:</b> Shrinkage prevents small districts with few projects from artificially dominating the Critical tier due to small-sample noise."
            ],
            "example": "District A has 200 projects, 45 of which trigger various detectors. Weighted raw score = 68.2. Shrunk score = 64.5, placing District A in the Top 10% Critical tier for prioritized audit."
        },
        {
            "id": "Detector 14",
            "name": "MP & Constituency Risk Profiler",
            "method": "Hierarchical Empirical Bayes Portfolio Risk Aggregator",
            "summary": "Synthesizes anomaly results across an entire parliamentarian's project portfolio, evaluating the breadth, frequency, and severity of irregular patterns to establish an executive risk profile and comparative ranking.",
            "rules": [
                "<b>Raw Portfolio Score:</b> Sum of (Violation Rate x 100 x Mean Severity x Detector Weight), capped at 100.",
                "<b>Empirical Bayes Shrinkage (m=20):</b> Shrunk Risk = Raw Risk * [N / (N + 20)] + National MP Mean * [20 / (N + 20)], where N is total MP works.",
                "<b>Percentile Tiers:</b> Top 10% of MPs by shrunk risk -> Critical; Next 20% (10%-30%) -> High; Next 30% (30%-60%) -> Medium; Remaining 40% -> Clean.",
                "<b>Safeguard:</b> Newly elected MPs with under 10 works are stabilized toward the national mean so a single delayed work does not create an artificial Critical score."
            ],
            "example": "An MP recommends 120 projects, 35 of which are flagged across smurfing, vague descriptions, and round-number screen. Shrunk risk = 54.1 (88th percentile -> High Risk tier)."
        },
        {
            "id": "Detector 15",
            "name": "Copy-Paste Pricing",
            "method": "Combinatorial Pricing & Cloned Estimates Forensics",
            "summary": "Identifies cloned or copy-pasted budgeting where unrelated projects under the same MP share identical total project costs across different categories, or share identical rounded unit rates within the same category.",
            "rules": [
                "<b>Signal 1 (Cross-Category Exact Cost Clone):</b> >= 5 works under same MP share identical cost AND span > 1 category. Severity: 5 works (0.75), 10 works (0.88), 20 works (0.98).",
                "<b>Signal 2 (Cloned Unit Rate):</b> Quantity parsed with high confidence; Unit Rate = Cost / Quantity rounded to nearest Rs. 100. >= 5 works under same MP & category share identical rate. Severity: 5 repeats (0.50), 10 repeats (0.70), 20 repeats (0.90).",
                "<b>Combination:</b> Final Severity = Max(Cross-Category, Cloned Unit Rate).",
                "<b>Safeguard:</b> 5 identical road segments do NOT trigger cross-category alerts; unit-rate checks strictly require high-confidence text extraction."
            ],
            "example": "An MP has 6 projects budgeted at exactly Rs. 10,00,000 across 5 different categories (Road, School, Water, Lighting, Hall, Drainage). Signal 1 triggers with 0.75 Severity for boilerplate budgeting."
        }
    ]

    for det in detectors:
        card = []
        
        # Detector Title & Subtitle line
        header_table_data = [[
            p(f"<b>{det['id']}: {det['name']}</b>", det_title_style),
            p(det['method'], det_method_style)
        ]]
        t_header = Table(header_table_data, colWidths=[290, 222])
        t_header.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        card.append(t_header)
        card.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=1, spaceAfter=2))
        
        # Summary
        card.append(p(f"<b>Overview:</b> {det['summary']}", body_style))
        
        # Rules
        for r in det['rules']:
            card.append(p(f"- {r}", bullet_style))
            
        # Example
        card.append(p(f"<b>Real-World Example:</b> {det['example']}", body_style))
        card.append(Spacer(1, 4))

        story.append(KeepTogether(card))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Concise PDF successfully built: {output_filename}")


if __name__ == "__main__":
    downloads_pdf = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Guide.pdf"
    spec_pdf = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Specification.pdf"
    local_pdf = "/Users/suvendu/Downloads/SIH-DATA/SATARK_MPLADS_15_Detectors_Guide.pdf"

    build_concise_pdf(downloads_pdf)
    build_concise_pdf(spec_pdf)
    build_concise_pdf(local_pdf)
