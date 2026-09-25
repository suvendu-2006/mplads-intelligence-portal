#!/usr/bin/env python3
"""
Generates an ultra-concise, strictly 2-PAGE Executive Briefing Document for all 15 Detectors.
Outputs:
1. SATARK_MPLADS_15_Detectors_Guide.pdf (Strictly 2 pages)
2. SATARK_MPLADS_15_Detectors_Guide.docx (Compact ~2 pages)
Also mirrors to SATARK_MPLADS_15_Detectors_Specification.(pdf/docx) in /Users/suvendu/Downloads/

Key Principles:
- Zero black boxes: 100% clean ASCII. Uses 'Rs.' instead of Rupee symbol, standard hyphens, escaped XML entities.
- Exactly 2 pages:
    * Page 1: Header + Detectors 01 to 08 (Project-Level Detectors)
    * Page 2: Detectors 09 to 15 (Financial, Text & Portfolio Profilers) + Executive Scoring Matrix
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

# ==================== DATA DEFINITION (ALL 15 DETECTORS) ====================
DETECTORS = [
    {
        "id": "D-01",
        "name": "Unusual Pattern Detection",
        "method": "Isolation Forest (6 features)",
        "target": "Identifies multidimensional statistical outliers across cost, duration, and completion timing relative to peers in the same district and category.",
        "rules": "Features: Log(Cost), Elapsed Days, Completion Month, Category & District Median Deltas, Days per Lakh Spent. Requires >= 50 completed works.",
        "safeguard": "Outliers indicate statistical rarity (e.g., specialized foundation or flood relief), not automatic fraud."
    },
    {
        "id": "D-02",
        "name": "Duplicate Work Detection",
        "method": "Sentence Transformers & Union-Find",
        "target": "Detects double-billing where project descriptions describe the same physical asset in the same district.",
        "rules": "Intra-district only. High-confidence: Cosine similarity >= 0.95, OR (>= 0.93 + same Category + Cost within 70%-143%). Borderline (0.88-0.93) to review desk. Descriptions < 20 chars ignored.",
        "safeguard": "Cross-district pairs prohibited; common boilerplate phrases repeated > 10 times are excluded."
    },
    {
        "id": "D-03",
        "name": "Cost Overrun Detection",
        "method": "CPWD DSR 2023 Statutory Rates",
        "target": "Validates billed unit rates against official Central Public Works Department ceilings.",
        "rules": "Max Allowed Rate = Base Rate x (1 + 0.06)^(Years post-2023) x (1 + 0.25 Base Buffer + 0.15 Terrain Buffer). Trigger: Rate exceeds ceiling by >= 5.0% AND excess spend >= Rs. 10,000.",
        "safeguard": "Hilly/remote districts receive +15% statutory tolerance allowance automatically."
    },
    {
        "id": "D-04",
        "name": "Ghost Works Detection",
        "method": "Disbursement Audit & Ledger Check",
        "target": "Flags projects marked 'completed' on paper with zero or near-zero disbursement in official payment ledgers.",
        "rules": "Signal 1: Status = 'completed' but verified payment = Rs. 0 (Base 0.80). Signal 2: Paid < 50% of cost. Signal 3: MP portfolio has >= 40% aggregate payment gap. Combined: Max + 0.10.",
        "safeguard": "Missing payment record treated as unknown (not Rs. 0). 30-day grace (0.60x) for recent works; < Rs. 50k scaled by 0.80x."
    },
    {
        "id": "D-05",
        "name": "Bill Splitting (Smurfing)",
        "method": "Tender Threshold Fragmentation",
        "target": "Catches splitting large works into smaller contracts just below statutory tender caps.",
        "rules": "Rs. 5L Band (Rs. 4.5L - <Rs. 5L): >= 3 works in same month by same MP (0.60; >= 5 works -> 0.80). Rs. 20L Band (Rs. 18L - <Rs. 20L): >= 2 works & sum >= Rs. 20 Lakh (0.70). +0.10 for same category.",
        "safeguard": "Isolated sub-5L contracts or contracts in different months are never flagged."
    },
    {
        "id": "D-06",
        "name": "Delays & Stalled Works",
        "method": "Statutory 365-Day Timeline",
        "target": "Flags active works stalled past the 1-year statutory guideline or finished works with severe delays.",
        "rules": "Active Stalled: Age > 365 days (Severity: 365d -> 0.50, 548d -> 0.65, 730d -> 0.80, 1095d -> 1.00). Finished Delayed: Duration > 365d (0.30 to 0.80).",
        "safeguard": "Multi-phase keywords ('phase', 'stage', 'part', 'package') receive 20% discount (0.80x) and hard cap at 0.69."
    },
    {
        "id": "D-07",
        "name": "Suspicious Timing Forensics",
        "method": "March Dumping & Term Rush",
        "target": "Identifies artificial completions and budget surges driven by fiscal deadlines or election cycles.",
        "rules": "March Dumping: March Index = 40% (March Works %) + 60% (March Spend %); severity scales for Index >= 30% (0.50) to 85% (1.00). Term Rush: Final 6-mo velocity / prior 54-mo velocity >= 2.0x (0.50-1.00).",
        "safeguard": "60% spend weighting prevents many minor works from triggering alarms unless major funds are dumped."
    },
    {
        "id": "D-08",
        "name": "Same-Day Bulk Completion",
        "method": "Trimmed Baseline + 3-Sigma Spike",
        "target": "Detects batch sign-offs of massive project counts on a single calendar day without field inspection.",
        "rules": "District daily completions >= Mean + 3*StdDev (floor 10 works). Spike ratio: 10x (0.40) to 100x (1.00). Date boost: March 25-30 (+0.10), March 31 (+0.20). MP closing >= 8 works on 1 day flagged.",
        "safeguard": "Bulk supply keywords ('street light', 'lamp', 'led', 'pole') discounted by 30% (0.70x); quarter-ends by 20%."
    },
    {
        "id": "D-09",
        "name": "Round-Number & Benford",
        "method": "Digit Forensics & Lakh Multiples",
        "target": "Identifies manufactured budgets violating natural logarithmic digit distributions or clustered at round amounts.",
        "rules": "1st/2nd digit Chi-Square against Benford (min 45/60 works, Bonferroni p < 0.05). Roundness concentration: flags if MP has >= 30% works at exact Rs. 1L/5L/10L multiples, or individual project is exact Rs. 5L/10L.",
        "safeguard": "A single round project is never flagged on its own without portfolio-level concentration."
    },
    {
        "id": "D-10",
        "name": "Vague Description Flag",
        "method": "5-Tier NLP Specificity Scoring",
        "target": "Flags missing, extremely short, generic, or boilerplate project scopes.",
        "rules": "Missing/empty description: 1.00 Critical. Cost < Rs. 2 Lakh exempt. Length < 25 chars for >= Rs. 5L (0.85); < 20 chars for Rs. 2L-5L (0.75). Generic phrases ('development work') or Specificity < 0.12 (0.80). Template reuse >= 10x.",
        "safeguard": "Projects under Rs. 2 Lakh are exempt. Standard engineering specs (RCC, M20, chainage) boost score."
    },
    {
        "id": "D-11",
        "name": "Category-Amount Mismatch",
        "method": "Physical Engineering Bounds",
        "target": "Catches project costs outside physical feasibility (e.g. Rs. 28L for 1 handpump or Rs. 45k for a school).",
        "rules": "7 Standard Bounds: School (Rs. 5L-2Cr), Hall (Rs. 3L-1.5Cr), Handpump (Rs. 25k-1L), Tank (Rs. 4L-30L), Wall (Rs. 50k-50L), Light (Rs. 3k-35k), Road (Rs. 50k-2.5Cr). Ratio = Cost / Max (high) or Min / Cost (low).",
        "safeguard": "Unrecognized categories are safely skipped rather than evaluated against arbitrary numbers."
    },
    {
        "id": "D-12",
        "name": "Verification Gap Flag",
        "method": "Macro Ledger Reconciliation",
        "target": "Reconciles bottom-up completed project expenditure against top-down MP official financial ledgers.",
        "rules": "Macro: Database Sum / Ledger Completed Value > 1.15 (15% excess) -> Severity 0.50 to 1.00. Micro: Disbursement < 25% AND MP portfolio payment gap >= 60%. Final: Max(Macro, Micro).",
        "safeguard": "Missing payment records are never assumed to be Rs. 0 paid, avoiding false pipeline alerts."
    },
    {
        "id": "D-13",
        "name": "IDA Risk Profiler",
        "method": "Empirical Bayes Shrinkage (m=30)",
        "target": "Aggregates project-level anomalies across D-01 to D-12 to score and rank Implementing District Authorities.",
        "rules": "Raw Score = Sum(Violation Rate x 100 x Mean Severity x Weight). Shrunk Score = Raw * [N/(N+30)] + National Mean * [30/(N+30)]. Percentile Tiers: Top 10% Critical, 10%-30% High, 30%-60% Medium, 40% Clean.",
        "safeguard": "Shrinkage prevents small districts with few works from dominating the Critical tier due to small sample size."
    },
    {
        "id": "D-14",
        "name": "MP & Constituency Profiler",
        "method": "Empirical Bayes Shrinkage (m=20)",
        "target": "Synthesizes portfolio-wide anomaly patterns to establish an executive risk profile and ranking for each MP.",
        "rules": "Raw Score = Sum(Violation Rate x 100 x Mean Severity x Weight). Shrunk Score = Raw * [N/(N+20)] + National MP Mean * [20/(N+20)]. Percentile Tiers: Top 10% Critical, 10%-30% High, 30%-60% Medium, 40% Clean.",
        "safeguard": "Stabilizes newly elected MPs with under 10 works against misleading high percentages."
    },
    {
        "id": "D-15",
        "name": "Copy-Paste Pricing",
        "method": "Cloned Estimate Clustering",
        "target": "Identifies reused boilerplate estimates across projects under the same MP.",
        "rules": "Signal 1: Same MP has >= 5 works with exact same cost spanning > 1 category (5 works -> 0.75, 10 -> 0.88, 20 -> 0.98). Signal 2: Same MP & category have >= 5 works with identical rounded unit rate (Rs. 100 rounding).",
        "safeguard": "Multiple road segments do not trigger cross-category alerts; unit rates require high extraction confidence."
    }
]

# ==================== 1. GENERATE STRICTLY 2-PAGE PDF ====================
class TwoPageCanvas(canvas.Canvas):
    """Canvas that enforces clean running headers and footers."""
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
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header
        self.drawString(36, 11 * 72 - 24, "SATARK MPLADS Intelligence Portal - Executive Anomaly Detection Reference (15 Detectors)")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 11 * 72 - 28, 8.5 * 72 - 36, 11 * 72 - 28)
            
        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 36, 18, page_str)
        self.drawString(36, 18, "CONFIDENTIAL - AUDIT & VIGILANCE FORENSIC SPECIFICATION - ALL VALUES IN RS.")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 26, 8.5 * 72 - 36, 26)
        
        self.restoreState()

def build_2page_pdf(pdf_path: str):
    # Printable area: width = 8.5*72 - 72 = 540 pt, height = 11*72 - 64 = 728 pt
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=34,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'TStyle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=13, leading=16,
        textColor=colors.HexColor("#0F172A")
    )
    sub_style = ParagraphStyle(
        'SStyle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=10.5,
        textColor=colors.HexColor("#475569")
    )
    sec_style = ParagraphStyle(
        'SecStyle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=9.5, leading=12,
        textColor=colors.HexColor("#1E3A8A"), spaceBefore=2, spaceAfter=2
    )
    th_style = ParagraphStyle(
        'THStyle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
        textColor=colors.white
    )
    id_style = ParagraphStyle(
        'IDStyle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
        textColor=colors.HexColor("#1E3A8A")
    )
    name_style = ParagraphStyle(
        'NStyle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
        textColor=colors.HexColor("#0F172A")
    )
    method_style = ParagraphStyle(
        'MStyle', parent=styles['Normal'],
        fontName='Helvetica-Oblique', fontSize=6.5, leading=8.5,
        textColor=colors.HexColor("#2563EB")
    )
    cell_style = ParagraphStyle(
        'CStyle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=7, leading=9,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # ==================== PAGE 1 ====================
    story.append(Paragraph("SATARK MPLADS Intelligence Portal - Executive Detector Handbook", title_style))
    story.append(Paragraph(
        "<b>System Purpose:</b> 15 automated forensic engines screening project data for corruption, duplication, cost overruns, and timeline anomalies. "
        "Anomalies serve as risk-scored audit leads, not unilateral proof. All monetary metrics are in Indian Rupees (Rs.).",
        sub_style
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Part I: Project-Level Execution & Timeline Detectors (D-01 to D-08)", sec_style))

    # Table 1: D-01 to D-08
    t1_data = [[
        Paragraph("ID", th_style),
        Paragraph("Detector & Method", th_style),
        Paragraph("Detection Target & Core Rules", th_style),
        Paragraph("Thresholds & Safeguards", th_style)
    ]]

    for d in DETECTORS[:8]:
        col1 = Paragraph(d["id"], id_style)
        col2 = [Paragraph(d["name"], name_style), Paragraph(d["method"], method_style)]
        col3 = [Paragraph(f"<b>Target:</b> {d['target']}", cell_style), Paragraph(f"<b>Rules:</b> {d['rules']}", cell_style)]
        col4 = Paragraph(f"<b>Safeguard:</b> {d['safeguard']}", cell_style)
        t1_data.append([col1, col2, col3, col4])

    # Width: 28 + 120 + 242 + 150 = 540 pt
    t1 = Table(t1_data, colWidths=[28, 120, 242, 150])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(t1)

    story.append(PageBreak())

    # ==================== PAGE 2 ====================
    story.append(Paragraph("Part II: Financial, Text, & Portfolio-Level Detectors (D-09 to D-15)", sec_style))

    t2_data = [[
        Paragraph("ID", th_style),
        Paragraph("Detector & Method", th_style),
        Paragraph("Detection Target & Core Rules", th_style),
        Paragraph("Thresholds & Safeguards", th_style)
    ]]

    for d in DETECTORS[8:]:
        col1 = Paragraph(d["id"], id_style)
        col2 = [Paragraph(d["name"], name_style), Paragraph(d["method"], method_style)]
        col3 = [Paragraph(f"<b>Target:</b> {d['target']}", cell_style), Paragraph(f"<b>Rules:</b> {d['rules']}", cell_style)]
        col4 = Paragraph(f"<b>Safeguard:</b> {d['safeguard']}", cell_style)
        t2_data.append([col1, col2, col3, col4])

    t2 = Table(t2_data, colWidths=[28, 120, 242, 150])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(t2)
    story.append(Spacer(1, 4))

    # Executive Risk Governance Matrix
    story.append(Paragraph("Executive Severity Scoring & Entity Percentile Governance", sec_style))
    gov_data = [
        [
            Paragraph("Metric", th_style),
            Paragraph("Critical Tier (Top 10%)", th_style),
            Paragraph("High Risk (Next 20%)", th_style),
            Paragraph("Medium Risk (Next 30%)", th_style),
            Paragraph("Clean / Low Risk (40%)", th_style)
        ],
        [
            Paragraph("Project Severity", cell_style),
            Paragraph(">= 0.85 (Immediate physical inspection)", cell_style),
            Paragraph("0.60 - 0.84 (Audit sample priority)", cell_style),
            Paragraph("0.30 - 0.59 (Administrative review)", cell_style),
            Paragraph("< 0.30 (Normal baseline execution)", cell_style)
        ],
        [
            Paragraph("District (IDA) Profiler", cell_style),
            Paragraph("Top 10% Shrunk Risk (m=30)", cell_style),
            Paragraph("70th - 90th percentile", cell_style),
            Paragraph("40th - 70th percentile", cell_style),
            Paragraph("Bottom 40% of districts", cell_style)
        ],
        [
            Paragraph("MP Portfolio Profiler", cell_style),
            Paragraph("Top 10% Shrunk Risk (m=20)", cell_style),
            Paragraph("70th - 90th percentile", cell_style),
            Paragraph("40th - 70th percentile", cell_style),
            Paragraph("Bottom 40% of parliamentarians", cell_style)
        ]
    ]
    t_gov = Table(gov_data, colWidths=[100, 120, 110, 110, 100])
    t_gov.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(t_gov)

    doc.build(story, canvasmaker=TwoPageCanvas)
    print(f"2-Page PDF built successfully: {pdf_path}")


# ==================== 2. GENERATE COMPACT 2-PAGE WORD DOCUMENT ====================
def set_cell_margins(cell, top=60, bottom=60, left=90, right=90):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def build_compact_docx(docx_path: str):
    doc = Document()
    
    # 0.5-inch page margins for tight executive layout
    for s in doc.sections:
        s.top_margin = Inches(0.5)
        s.bottom_margin = Inches(0.5)
        s.left_margin = Inches(0.5)
        s.right_margin = Inches(0.5)

    normal = doc.styles['Normal']
    normal.font.name = 'Calibri'
    normal.font.size = Pt(8.5)
    normal.font.color.rgb = RGBColor(30, 41, 59)
    normal.paragraph_format.line_spacing = 1.05
    normal.paragraph_format.space_after = Pt(2)

    # Title
    p_t = doc.add_paragraph()
    p_t.paragraph_format.space_after = Pt(1)
    r_t = p_t.add_run("SATARK MPLADS Intelligence Portal - Executive 15-Detector Brief")
    r_t.font.name = 'Arial'
    r_t.font.size = Pt(14)
    r_t.font.bold = True
    r_t.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(4)
    r_sub = p_sub.add_run(
        "Executive reference covering all 15 automated anomaly & fraud detection engines. "
        "All values expressed in Indian Rupees (Rs.). Scores represent risk-prioritized audit leads."
    )
    r_sub.font.size = Pt(8)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Section 1 Header
    p_s1 = doc.add_paragraph()
    p_s1.paragraph_format.space_before = Pt(2)
    p_s1.paragraph_format.space_after = Pt(2)
    r_s1 = p_s1.add_run("Part I: Project-Level Execution & Timeline Detectors (D-01 to D-08)")
    r_s1.font.bold = True
    r_s1.font.size = Pt(10)
    r_s1.font.color.rgb = RGBColor(30, 58, 138)

    t1 = doc.add_table(rows=9, cols=4)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["ID", "Detector & Methodology", "Detection Target & Rules", "Thresholds & Safeguards"]
    for c_idx, h in enumerate(headers):
        cell = t1.cell(0, c_idx)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=70, bottom=70, left=90, right=90)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor(255, 255, 255)

    for r_idx, d in enumerate(DETECTORS[:8], start=1):
        bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        row = t1.rows[r_idx]
        
        # Col 0: ID
        c0 = row.cells[0]
        set_cell_background(c0, bg)
        set_cell_margins(c0)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(d["id"])
        r0.font.bold = True
        r0.font.color.rgb = RGBColor(30, 58, 138)
        
        # Col 1: Name & Method
        c1 = row.cells[1]
        set_cell_background(c1, bg)
        set_cell_margins(c1)
        p1 = c1.paragraphs[0]
        r1a = p1.add_run(d["name"] + "\n")
        r1a.font.bold = True
        r1b = p1.add_run(d["method"])
        r1b.font.italic = True
        r1b.font.size = Pt(7.5)
        r1b.font.color.rgb = RGBColor(37, 99, 235)

        # Col 2: Target & Rules
        c2 = row.cells[2]
        set_cell_background(c2, bg)
        set_cell_margins(c2)
        p2 = c2.paragraphs[0]
        p2.add_run("Target: ").font.bold = True
        p2.add_run(d["target"] + " ")
        p2.add_run("Rules: ").font.bold = True
        p2.add_run(d["rules"])

        # Col 3: Safeguard
        c3 = row.cells[3]
        set_cell_background(c3, bg)
        set_cell_margins(c3)
        p3 = c3.paragraphs[0]
        p3.add_run("Safeguard: ").font.bold = True
        p3.add_run(d["safeguard"])

    doc.add_page_break()

    # Section 2 Header
    p_s2 = doc.add_paragraph()
    p_s2.paragraph_format.space_before = Pt(2)
    p_s2.paragraph_format.space_after = Pt(2)
    r_s2 = p_s2.add_run("Part II: Financial, Text, & Portfolio-Level Detectors (D-09 to D-15)")
    r_s2.font.bold = True
    r_s2.font.size = Pt(10)
    r_s2.font.color.rgb = RGBColor(30, 58, 138)

    t2 = doc.add_table(rows=8, cols=4)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    for c_idx, h in enumerate(headers):
        cell = t2.cell(0, c_idx)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=70, bottom=70, left=90, right=90)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor(255, 255, 255)

    for r_idx, d in enumerate(DETECTORS[8:], start=1):
        bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        row = t2.rows[r_idx]
        
        c0 = row.cells[0]
        set_cell_background(c0, bg)
        set_cell_margins(c0)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(d["id"])
        r0.font.bold = True
        r0.font.color.rgb = RGBColor(30, 58, 138)
        
        c1 = row.cells[1]
        set_cell_background(c1, bg)
        set_cell_margins(c1)
        p1 = c1.paragraphs[0]
        r1a = p1.add_run(d["name"] + "\n")
        r1a.font.bold = True
        r1b = p1.add_run(d["method"])
        r1b.font.italic = True
        r1b.font.size = Pt(7.5)
        r1b.font.color.rgb = RGBColor(37, 99, 235)

        c2 = row.cells[2]
        set_cell_background(c2, bg)
        set_cell_margins(c2)
        p2 = c2.paragraphs[0]
        p2.add_run("Target: ").font.bold = True
        p2.add_run(d["target"] + " ")
        p2.add_run("Rules: ").font.bold = True
        p2.add_run(d["rules"])

        c3 = row.cells[3]
        set_cell_background(c3, bg)
        set_cell_margins(c3)
        p3 = c3.paragraphs[0]
        p3.add_run("Safeguard: ").font.bold = True
        p3.add_run(d["safeguard"])

    # Executive Governance Table
    p_gov = doc.add_paragraph()
    p_gov.paragraph_format.space_before = Pt(6)
    p_gov.paragraph_format.space_after = Pt(2)
    r_gov = p_gov.add_run("Executive Severity & Percentile Governance Tiers")
    r_gov.font.bold = True
    r_gov.font.size = Pt(9.5)
    r_gov.font.color.rgb = RGBColor(15, 23, 42)

    t_gov = doc.add_table(rows=4, cols=5)
    t_gov.alignment = WD_TABLE_ALIGNMENT.CENTER
    gov_headers = ["Metric", "Critical (Top 10%)", "High Risk (Next 20%)", "Medium Risk (Next 30%)", "Clean / Low Risk (40%)"]
    for c_idx, h in enumerate(gov_headers):
        cell = t_gov.cell(0, c_idx)
        set_cell_background(cell, "0F172A")
        set_cell_margins(cell, top=60, bottom=60, left=80, right=80)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.size = Pt(7.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    gov_rows = [
        ("Project Severity", ">= 0.85 (Physical inspection priority)", "0.60 - 0.84 (Audit sample priority)", "0.30 - 0.59 (Administrative review)", "< 0.30 (Normal baseline)"),
        ("District (IDA) Profiler", "Top 10% Shrunk Risk (m=30)", "70th - 90th percentile", "40th - 70th percentile", "Bottom 40% of districts"),
        ("MP Portfolio Profiler", "Top 10% Shrunk Risk (m=20)", "70th - 90th percentile", "40th - 70th percentile", "Bottom 40% of MPs")
    ]
    for r_idx, row_data in enumerate(gov_rows, start=1):
        bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
        row = t_gov.rows[r_idx]
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=50, bottom=50, left=70, right=70)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(7.5)
            if c_idx == 0:
                r.font.bold = True

    doc.save(docx_path)
    print(f"Compact Word document built successfully: {docx_path}")


if __name__ == "__main__":
    downloads_pdf = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Guide.pdf"
    spec_pdf = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Specification.pdf"
    
    downloads_docx = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Simple_Guide.docx"
    spec_docx = "/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Specification.docx"

    build_2page_pdf(downloads_pdf)
    build_2page_pdf(spec_pdf)

    build_compact_docx(downloads_docx)
    build_compact_docx(spec_docx)
