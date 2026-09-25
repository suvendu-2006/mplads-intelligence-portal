#!/usr/bin/env python3
"""
Generates the comprehensive technical specification document for all 15 SATARK MPLADS Fraud & Anomaly Detectors.
Minimizes repetitive phrasing while preserving 100% of mathematical, operational, architectural, and investigative context.
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner padding for a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_background(cell, fill_hex):
    """Set shading/background color for a table cell."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def style_table(table, header_bg="1E3A8A", alt_row_bg="F1F5F9"):
    """Applies clean executive styling to a docx table."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Format header
    for i, cell in enumerate(table.rows[0].cells):
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for r in p.runs:
                r.font.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.name = "Calibri"
                r.font.size = Pt(9.5)
    
    # Format body rows
    for r_idx, row in enumerate(table.rows[1:], start=1):
        bg = alt_row_bg if r_idx % 2 == 1 else "FFFFFF"
        for cell in row.cells:
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=90, bottom=90, left=130, right=130)
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.name = "Calibri"
                    r.font.size = Pt(9)
                    r.font.color.rgb = RGBColor(30, 41, 59)

def add_callout(doc, text, alert_type="NOTE"):
    """Adds a GitHub-style colored alert callout block."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    
    bg_color = "EFF6FF" if alert_type == "NOTE" else "FFFBEB" if alert_type == "CAUTION" else "FEF2F2"
    border_color = "3B82F6" if alert_type == "NOTE" else "F59E0B" if alert_type == "CAUTION" else "EF4444"
    title_prefix = "NOTE: " if alert_type == "NOTE" else "CAVEAT & SAFEGUARD: " if alert_type == "CAUTION" else "CRITICAL INVESTIGATIVE RULE: "
    
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=120, bottom=120, left=180, right=140)
    
    # Left border only styling via XML
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="none"/>\n'
        f'  <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>\n'
        f'  <w:bottom w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    
    r_title = p.add_run(title_prefix)
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(9)
    if alert_type == "NOTE":
        r_title.font.color.rgb = RGBColor(30, 64, 175)
    elif alert_type == "CAUTION":
        r_title.font.color.rgb = RGBColor(180, 83, 9)
    else:
        r_title.font.color.rgb = RGBColor(185, 28, 28)
        
    r_body = p.add_run(text)
    r_body.font.name = "Calibri"
    r_body.font.size = Pt(9)
    r_body.font.color.rgb = RGBColor(51, 65, 85)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def build_word_document(output_path: str):
    doc = Document()
    
    # Document Page Margins (1 inch)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        
    # Styles configuration
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(4)

    # ========================== COVER / HEADER ==========================
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(10)
    title_p.paragraph_format.space_after = Pt(2)
    run_title = title_p.add_run("SATARK MPLADS Intelligence Portal")
    run_title.font.name = 'Arial'
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(14)
    run_sub = sub_p.add_run("Consolidated Technical Specification: 15 Multi-Dimensional Anomaly & Fraud Detectors")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(13)
    run_sub.font.color.rgb = RGBColor(71, 85, 105)

    meta_tbl = doc.add_table(rows=2, cols=4)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        [("System Version", True), ("v2.4.0-Production", False), ("Scope", True), ("All 15 Specialized Detectors", False)],
        [("Audience", True), ("Audit & Vigilance Authorities", False), ("Methodology", True), ("ML, NLP, Benford, CPWD DSR, Bayes", False)]
    ]
    for r_idx, row_values in enumerate(meta_data):
        for c_idx, (text, is_bold) in enumerate(row_values):
            cell = meta_tbl.cell(r_idx, c_idx)
            set_cell_background(cell, "F8FAFC" if is_bold else "FFFFFF")
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Calibri"
            r.font.size = Pt(8.5)
            r.font.bold = is_bold
            if is_bold:
                r.font.color.rgb = RGBColor(30, 41, 59)
            else:
                r.font.color.rgb = RGBColor(71, 85, 105)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Executive Overview
    h_exec = doc.add_heading(level=1)
    r_h_exec = h_exec.add_run("Executive Architecture & Master Registry")
    r_h_exec.font.name = 'Arial'
    r_h_exec.font.size = Pt(14)
    r_h_exec.font.color.rgb = RGBColor(30, 58, 138)
    
    doc.add_paragraph(
        "The SATARK MPLADS fraud detection subsystem comprises 15 distinct, specialized analytical engines. "
        "Each detector operates with strict statistical bounds, domain-grounded engineering ceilings (CPWD DSR 2023), "
        "false-positive safeguards (grace periods, multi-phase buffers, Bonferroni corrections), and calibrated severity scales. "
        "Anomalies serve as early-warning forensic leads for physical verification, never unilateral accusations."
    )

    # Master Overview Table
    master_tbl = doc.add_table(rows=16, cols=4)
    master_headers = ["ID", "Detector Name", "Core Methodology / Technique", "Primary Detection Target"]
    for c_idx, text in enumerate(master_headers):
        master_tbl.cell(0, c_idx).paragraphs[0].text = text
    
    registry = [
        ("D-01", "Unusual Pattern Detection", "Isolation Forest (6 engineered features)", "Statistical outliers in multi-dimensional cost/time space"),
        ("D-02", "Duplicate Work Detection", "SentenceTransformer / TF-IDF + Union-Find", "Semantic duplicate descriptions in same district & MP"),
        ("D-03", "Cost Overrun Detection", "CPWD DSR 2023 + Inflation + Terrain Tolerance", "Billed unit rates exceeding statutory engineering ceilings"),
        ("D-04", "Ghost Works Detection", "Disbursement Ratio & Portfolio Gap Triangulation", "Completed projects with ₹0 paid or severe payment deficits"),
        ("D-05", "Bill Splitting / Smurfing", "Narrow Band Clustering (5L and 20L)", "Sub-threshold fragmentation bypassing tender limits"),
        ("D-06", "Delays & Stalled Works", "Timeline Age & Monotonic Duration Scaling", "Works exceeding statutory 365-day guideline without completion"),
        ("D-07", "Suspicious Timing Forensics", "Weighted Fiscal Ratio & Pre-Election Velocity", "Year-end March dumping (60% spend wt) and term-end rushes"),
        ("D-08", "Same-Day Bulk Completion", "Outlier-Trimmed Baseline & Poisson-Style Spike", "Mass simultaneous project sign-offs on single calendar days"),
        ("D-09", "Benford & Round-Number Screen", "1st/2nd Digit Chi-Square + Exact-Lakh Concentration", "Fabricated or round budget allocations violating natural digits"),
        ("D-10", "Vague Description Flag", "5-Tier Specificity Scoring & Template Clustering", "Boilerplate, uninformative, or missing project scopes"),
        ("D-11", "Category-Amount Mismatch", "Engineering Plausibility Matrix (Min/Max Unit Bounds)", "Physically impossible costs per physical quantity unit"),
        ("D-12", "Verification Gap Flag", "Macro Ledger vs. Micro Aggregation Reconciliation", "Sum of completed works exceeding official financial ledger"),
        ("D-13", "IDA Risk Profiler", "Hierarchical Empirical Bayes Shrinkage (m=30)", "District-level composite risk indexing & percentile tiers"),
        ("D-14", "MP & Constituency Profiler", "Hierarchical Empirical Bayes Shrinkage (m=20)", "Parliamentarian portfolio-level risk indexing & percentile tiers"),
        ("D-15", "Copy-Paste Pricing", "Cross-Category Exact Cost & Rounded Unit Rate Clustering", "Reused, cloned estimates across unrelated project categories")
    ]

    for r_idx, (d_id, d_name, d_method, d_target) in enumerate(registry, start=1):
        master_tbl.cell(r_idx, 0).paragraphs[0].text = d_id
        master_tbl.cell(r_idx, 1).paragraphs[0].text = d_name
        master_tbl.cell(r_idx, 2).paragraphs[0].text = d_method
        master_tbl.cell(r_idx, 3).paragraphs[0].text = d_target
        
    style_table(master_tbl, header_bg="0F172A", alt_row_bg="F8FAFC")
    doc.add_page_break()

    # ========================== DETAILED DETECTOR SPECIFICATIONS ==========================

    detectors_content = [
        {
            "num": 1,
            "name": "Unusual Pattern Detection Using Isolation Forest",
            "type": "Machine Learning Anomaly Detection",
            "purpose": (
                "Identifies MPLADS works exhibiting extreme multi-dimensional deviations in cost, execution duration, and time-to-cost efficiency. "
                "Instead of evaluating cost or timeline in isolation, it analyzes whether a project represents an unusual multivariate configuration "
                "relative to peers in the same district and work category."
            ),
            "features": [
                "Log-Transformed Project Cost: Compresses wide expenditure disparities (₹2 Lakh to ₹5+ Crore) into a normalized scale.",
                "Execution Duration (Days): Elapsed time between official recommendation date and verified completion date.",
                "Completion Month (1–12): Cyclical indicator capturing operational timing across the financial calendar.",
                "Category Median Cost Delta: Percentage deviation from the robust median expenditure of works within the same category.",
                "District Median Cost Delta: Deviation from localized typical expenditure, adjusting for geographical price realities.",
                "Days per Lakh Spent: Efficiency metric (Duration ÷ (Cost / 100,000)) identifying projects that were abnormally fast or sluggish relative to budget."
            ],
            "rules": [
                "Minimum Dataset Guardrail: Requires >= 50 valid completed projects in the database. Below this threshold, anomaly detection halts to prevent spurious scores.",
                "Data Cleansing: Automatically purges projects with missing completion dates or logically invalid dates (completion preceding recommendation).",
                "Unsupervised Isolation: Isolation Forest isolates anomalous points via random feature partitioning trees without requiring labeled training fraud sets.",
                "Anomaly Thresholding: Projects with decision function scores falling into the lower distribution percentile are identified as statistical outliers."
            ],
            "severity": "Monotonically mapped from the outlier's anomaly score. Projects exhibiting marginal deviations receive lower severity, while extreme multi-dimensional deviations receive higher severity up to 1.00. Filtered against global SEVERITY_FLOOR.",
            "mitigation": "Anomalies denote statistical distinctiveness, not fraud. Legitimate causes include specialized geological conditions, flood-relief emergency infrastructure, or custom engineering requirements.",
            "workflow": [
                "1. Database Query: Ingest project cost, category, district, recommended date, completion date.",
                "2. Feature Engineering: Compute log(cost), duration, completion month, category delta, district delta, days-per-lakh.",
                "3. Validation Filter: Verify >= 50 completed records; exclude malformed timeline dates.",
                "4. Model Execution: Fit Isolation Forest on the standardized 6-dimensional feature matrix.",
                "5. Anomaly Scoring & Floor Check: Calculate anomaly score, thresholding, and severity mapping.",
                "6. Evidence Persistence: Generate human-readable rationale with feature importance and persist Anomaly record."
            ]
        },
        {
            "num": 2,
            "name": "Duplicate Work Detection (Semantic NLP & Union-Find)",
            "type": "Natural Language Processing & Graph Clustering",
            "purpose": (
                "Detects potential double-billing or multi-funded projects where project descriptions describe essentially the same physical work "
                "despite variations in vocabulary, abbreviations, or phrasing (e.g., 'Construction of concrete road' vs. 'PCC road connecting village')."
            ),
            "features": [
                "Semantic Embeddings: High-dimensional vector representations generated via Multilingual Sentence Transformers (fallback: character n-gram TF-IDF).",
                "Local Embedding Cache: Persistent vector cache preventing redundant re-computation of processed descriptions.",
                "Geographical Constriction: Pairwise comparisons are strictly partitioned by District (cross-district similarities are excluded to prevent natural false alarms).",
                "Metadata Triangulation: Work Category congruence, MP association, and Cost Ratio bounds (0.70x to 1.43x)."
            ],
            "rules": [
                "Length Gate: Descriptions < 20 characters (e.g., 'Road work') are purged due to insufficient forensic specificity.",
                "Template Exclusion: Exact identical descriptions appearing > 10 times across the corpus are excluded as administrative boilerplate.",
                "High-Confidence Direct Duplicate: Cosine similarity >= 0.95, OR (similarity >= 0.93 + identical Category + Cost within 70%–143%).",
                "Human Review Queue: Borderline similarity (0.88 to 0.93) with identical MP, Category, District, and Cost is routed to a PENDING review desk rather than automatically flagged.",
                "Union-Find Graph Clustering: Connected pairwise duplicates are merged into clusters of 2 to 10 works."
            ],
            "severity": "Base severity derives from the mean cosine similarity of the cluster. A +0.10 severity boost is added if all works in the cluster were recommended by the exact same MP. Capped at 1.00.",
            "mitigation": "Differentiates true duplicate infrastructure from genuine multi-package development in adjacent hamlets. Borderline cases are reviewed manually by administrative officers.",
            "workflow": [
                "1. Filter Short & Template Descriptions: Discard < 20 chars; exclude boilerplate strings occurring > 10 times.",
                "2. Embedding Generation: Compute Transformer embeddings; fallback to TF-IDF if offline.",
                "3. District Partitioning: Group embeddings strictly by district.",
                "4. Pairwise Cosine Matrix: Compute cosine similarity for all intra-district pairs.",
                "5. Rule Evaluation: Categorize pairs into Ignored (<0.85), Review Queue (0.88–0.93 with metadata match), or High-Confidence (>=0.93/0.95).",
                "6. Union-Find Clustering: Merge duplicate pairs into connected components (clusters of size 2–10).",
                "7. Evidence Packaging: Record cluster ID, related work IDs, mean similarity, and create Anomaly records."
            ]
        },
        {
            "num": 3,
            "name": "Cost Overrun Detection Using CPWD DSR 2023 Benchmarks",
            "type": "Engineering Economics & Statutory Benchmark Ceilings",
            "purpose": (
                "Screens project invoices to verify whether billed unit rates exceed official Central Public Works Department (CPWD) "
                "Delhi Schedule of Rates (DSR 2023) statutory ceilings adjusted for compounding inflation and terrain hardship."
            ),
            "features": [
                "Standard Benchmark Registry: Official rates for CC roads, paver roads, handpumps, borewells, RO plants, school classrooms, community halls, solar/high-mast lights, boundary walls.",
                "Compounding Inflation Index: Annual 6% compounding escalation applied for completion years subsequent to 2023.",
                "Difficult Terrain Buffer: +15% statutory tolerance allowance automatically credited for projects located in classified hill/remote districts.",
                "Physical Quantity Extraction: Regular-expression extraction of linear meters (converting km to m), area (converting sq ft to sq m), and itemized units."
            ],
            "rules": [
                "Permissible Ceiling Formula: Max Allowed Rate = Base Rate x (1 + Inflation)^(Years post-2023) x (1 + Base Tolerance [25%] + Terrain Allowance [15%]).",
                "Dual Overrun Threshold: To trigger an alert, actual unit rate must exceed Permissible Ceiling by >= 5.0% AND estimated excess expenditure must be >= ₹10,000.",
                "Quantity Confidence Scaling: High confidence in text extraction assigns full severity; inferred or assumed quantities (e.g. default 1 unit) cap severity to prevent over-penalization."
            ],
            "severity": "Calibrated directly against excess percentage: 5% excess (0.30), 25% excess (0.50), 50% excess (0.75), >=100% excess (1.00). Reduced if quantity extraction confidence is moderate.",
            "mitigation": "Accounts for legitimate regional construction escalations through compounding inflation formulas and terrain multipliers before declaring an overrun.",
            "workflow": [
                "1. Category Mapping: Match work description and category to CPWD benchmark master schedule.",
                "2. Benchmark Escalation: Compute inflation adjustment (6% p.a.) and check district terrain status (+15%).",
                "3. Quantity Parsing: Extract physical metrics (meters, square meters, unit counts) with confidence ranking.",
                "4. Effective Unit Rate Calculation: Total Project Cost / Extracted Quantity.",
                "5. Overrun Test: Evaluate if Rate > Ceiling, Overrun % >= 5%, and Total Excess >= ₹10,000.",
                "6. Severity & Record Creation: Scale severity, assemble evidence (excess amount, benchmark rate, ceiling), and persist."
            ]
        },
        {
            "num": 4,
            "name": "Ghost Works Detection (Phantom Project Detection)",
            "type": "Financial Disbursement & Timeline Reconciler",
            "purpose": (
                "Identifies projects certified as completed on paper but lacking corroborating financial disbursement records, "
                "signaling potential phantom billing or diversion of funds."
            ),
            "features": [
                "Project Status Audit: Targets exclusively projects marked as 'completed'.",
                "Payment Record Integrity: Strict verification of whether an actual payment transaction ledger exists (missing records are NOT assumed to be ₹0).",
                "Disbursement Ratio: Verified total amount paid divided by total claimed project cost.",
                "MP Portfolio Payment Gap: Macro-level unverified financial drawdown percentage across the parliamentarian's entire constituency."
            ],
            "rules": [
                "Signal 1 (no_payment): Verified payment record exists, project marked completed, but total disbursement is exactly ₹0 (Base Severity: 0.80).",
                "Signal 2 (under_payment): Verified payment record exists, but total disbursement is < 50% of claimed cost (Severity scales with unpaid ratio).",
                "Signal 3 (mp_gap_context): MP portfolio exhibits >= 40% aggregate payment gap across completed works.",
                "Multi-Signal Compounding: Combined Severity = Max(Individual Signal Severities) + 0.10 for each additional signal (max 1.00)."
            ],
            "severity": "Derived from compounding signals, modified by: Recent Completion Grace (completion within 30 days multiplied by 0.60 to allow accounting transit); Small Project Buffer (costs < ₹50,000 multiplied by 0.80).",
            "mitigation": "Protects against missing data false positives by distinguishing 'missing payment record' (treated as unknown) from 'confirmed payment record showing ₹0'.",
            "workflow": [
                "1. Filter Dataset: Isolate records where status == 'completed'.",
                "2. Verify Ledger: Check if payment transaction table entry exists.",
                "3. Work-Level Evaluation: If record exists, check for ₹0 paid or < 50% disbursement ratio.",
                "4. Portfolio Triangulation: Check MP portfolio unverified payment gap (>=40%).",
                "5. Severity Adjustment: Apply 30-day recent completion factor (0.60x) and <₹50k factor (0.80x).",
                "6. Verification Check: Filter by SEVERITY_FLOOR and persist evidence (claimed cost, paid amount, drawdown ratio)."
            ]
        },
        {
            "num": 5,
            "name": "Bill Splitting / Smurfing (Procurement Threshold Fragmentation)",
            "type": "Contract Value Distribution Analysis",
            "purpose": (
                "Detects deliberate contract splitting where large capital works are fragmented into multiple smaller contracts "
                "priced just below mandatory tender or executive sanction thresholds (specifically ₹5 Lakh and ₹20 Lakh limits)."
            ),
            "features": [
                "Threshold Band 5L: Contracts priced between ₹4,50,000 and ₹4,99,999 (targeting the ₹5,00,000 procurement cap).",
                "Threshold Band 20L: Contracts priced between ₹18,00,000 and ₹19,99,999 (targeting the ₹20,00,000 technical sanction cap).",
                "Temporal Grouping: Recommendations grouped by MP + Calendar Month + Smurf Band.",
                "Category Homogeneity: Evaluates whether fragmented contracts share identical infrastructure classifications (e.g. all Roads)."
            ],
            "rules": [
                "5L Band Group Rule: 3 to 4 works in the same month by same MP -> Flagged (Base Severity 0.60); >= 5 works -> Flagged (Base Severity 0.80). (Fewer than 3 ignored).",
                "20L Band Group Rule: >= 2 works in the same month by same MP AND cumulative sum >= ₹20,00,000 -> Flagged (Base Severity 0.70).",
                "Category Homogeneity Boost: If all works in the cluster share the exact same category, add +0.10 severity boost (max 1.00)."
            ],
            "severity": "Base severity (0.60 to 0.80) based on band and group density, plus 0.10 category boost. Filtered against SEVERITY_FLOOR.",
            "mitigation": "Requires temporal clustering (same month) and threshold proximity. Isolated sub-5L contracts or works across different months are not flagged.",
            "workflow": [
                "1. Partition Costs: Filter records into 5L Band (₹4.5L–<₹5L) and 20L Band (₹18L–<₹20L).",
                "2. Cluster Creation: Group by MP Name + Recommendation Month + Band.",
                "3. Density Check: Evaluate 5L count (>=3) or 20L criteria (>=2 works & sum >= ₹20L).",
                "4. Category Inspection: Check if unique categories == 1 (apply +0.10 boost).",
                "5. Anomaly Generation: Emit individual anomaly records for each constituent work in the smurfed cluster."
            ]
        },
        {
            "num": 6,
            "name": "Delays & Stalled Works (Timeline Forensics)",
            "type": "Statutory Guideline Timeline Enforcement",
            "purpose": (
                "Catches ongoing public works stalled past the statutory 365-day (1-year) completion deadline, "
                "as well as finished projects that suffered extreme unapproved execution delays."
            ),
            "features": [
                "Recommendation & Completion Timestamps: Official administrative dates of sanction and physical completion.",
                "As-of Analysis Snapshot: Date reference used to compute elapsed operational duration for active works.",
                "Execution Duration Metric: Elapsed calendar days calculated against the 365-day statutory guideline.",
                "Multi-Phase Text Indicators: Detection of keywords ('phase', 'stage', 'part', 'package') denoting legitimate multi-year infrastructure."
            ],
            "rules": [
                "Branch 1 (Stalled In-Progress): Active works (status != 'completed' or missing completion date) with age > 365 days. Monotonic severity scale across [365, 548, 730, 1095] days -> [0.50, 0.65, 0.80, 1.00].",
                "Branch 2 (Completed Delayed): Finished works where (completion_date - recommended_date) > 365 days. Monotonic severity scale across [365, 548, 730, 1095] days -> [0.30, 0.45, 0.60, 0.80].",
                "Multi-Phase Safeguard: If description contains multi-phase keywords, severity is multiplied by 0.80 and hard-capped at 0.69 (preventing Critical tier classification).",
                "Critical Tier Threshold: Severity >= 0.90 flags project as critical overdue liability."
            ],
            "severity": "Monotonically scaled from 0.30 to 1.00 based on elapsed delay days past 1 year, discounted by 20% for multi-phase works.",
            "mitigation": "Differentiates stalled ongoing commitments from historical delays. Multi-phase packages are prevented from triggering critical emergency alerts.",
            "workflow": [
                "1. Filter Valid Dates: Purge records lacking valid recommendation dates.",
                "2. Multi-Phase Scan: Check description for 'phase', 'stage', 'part', 'package'.",
                "3. Branch Evaluation: Compute Age = as_of_date - rec_date (stalled) OR Duration = comp_date - rec_date (completed).",
                "4. Overdue Test: Check if elapsed time > 365 days; compute delay days.",
                "5. Severity Computation: Interpolate monotonic scale; apply 0.80x multiplier and 0.69 cap if multi-phase.",
                "6. Record Persistence: Assemble timeline evidence (recommended date, completion date, days overdue) and save."
            ]
        },
        {
            "num": 7,
            "name": "Suspicious Timing Forensics (March Dumping & Term Rush)",
            "type": "Temporal Expenditure Concentration Analysis",
            "purpose": (
                "Identifies artificial project completions and budget dumping driven by accounting deadlines (fiscal year-end March dumping) "
                "or political electoral cycles (pre-election term rush)."
            ),
            "features": [
                "Fiscal Calendar Mapping: April–March financial year indexing (Jan–Mar assigned to previous calendar year's FY).",
                "March Concentration Index: Weighted composite: 40% March Project Count % + 60% March Expenditure %.",
                "Term-End Reference Date: Fixed statutory reference (May 31, 2024 for 17th Lok Sabha).",
                "Velocity Rush Ratio: Monthly completion rate during final 6 months divided by monthly completion rate during prior 54 months."
            ],
            "rules": [
                "Signal 1 (March Fiscal Dumping): Evaluated per MP/FY. Combined March Index mapped to severity: Index 30 (0.50), 45 (0.65), 65 (0.85), 85 (1.00). (Baseline expectation is 8.3% per month).",
                "Signal 2 (Pre-Election Term Rush): Evaluated per MP. Requires >= 5 completed works in baseline 54-month period. Rush Ratio mapped to severity: 2.0x (0.50), 3.5x (0.65), 5.0x (0.80), 10.0x (1.00).",
                "Non-Additive Amalgamation: If a project exhibits both March dumping and term rush, Final Severity = Max(March Severity, Term Rush Severity)."
            ],
            "severity": "Derived from the higher of the March Index or Rush Ratio severity curves. Filtered against SEVERITY_FLOOR.",
            "mitigation": "Uses a 60% expenditure weighting so that many minor works closed in March do not distort scores unless massive capital funds are concentrated simultaneously.",
            "workflow": [
                "1. Timestamp Parsing: Map completion dates to fiscal years and flag March completions.",
                "2. March Index Computation: Calculate MP annual works %, spending %, and weighted composite.",
                "3. Term Rush Velocity: Compute final 6-month monthly rate vs. prior 54-month baseline (min 5 works).",
                "4. Signal Attachment: Map severities for March dumping and term rush; select max severity.",
                "5. Output Generation: Store completion date, fiscal year, rush ratio, and March index in evidence."
            ]
        },
        {
            "num": 8,
            "name": "Same-Day Bulk Completion (Daily Spike Forensics)",
            "type": "Statistical Process Control & Anomaly Spike Detection",
            "purpose": (
                "Detects administrative batch sign-offs where an implausibly large volume of distinct civil works are certified as completed "
                "on a single calendar day, indicating paper completions without genuine physical verification."
            ),
            "features": [
                "District Dynamic Baseline: Outlier-trimmed 95th percentile daily completion average and standard deviation.",
                "Spike Ratio: Total works completed on target date divided by normal daily district completion mean.",
                "Date Sensitivity Markers: Special scrutiny for March 25–30 (+0.10) and March 31 (+0.20 total).",
                "Category Homogeneity: Ratio of unique categories to total works on that date (< 20% indicates uniform batch processing).",
                "MP Same-Day Concentration: Dedicated check for parliamentarians closing >= 8 works on a single date."
            ],
            "rules": [
                "District Event Threshold: Daily works >= District Baseline (Mean + 3*StdDev, minimum floor of 10 works).",
                "Spike Ratio Severity: 10x normal (0.40), 20x (0.60), 50x (0.85), 100x (1.00).",
                "Homogeneity Boost: Unique Categories / Works < 0.20 adds +0.15 severity.",
                "MP-Level Batch Scale: 8 works (0.50), 15 works (0.70), 25 works (0.90). Composite = Max(District, MP).",
                "False-Positive Mitigations: Bulk supply/street light keywords ('street light', 'lamp', 'led', 'pole', 'supply of') reduce severity by 30% (0.70x). Standard quarter-ends (Jun/Sep/Dec 28+) reduced by 20% (0.80x)."
            ],
            "severity": "Max of district spike and MP batch severity, plus calendar and homogeneity boosts, discounted by supply and quarter-end buffers. Capped at 1.00.",
            "mitigation": "Supply-based contracts naturally delivered and installed in batches are shielded from false alarms via text keyword matching and quarter-end dampeners.",
            "workflow": [
                "1. District Baseline Model: Compute 95th percentile trimmed mean and StdDev of daily completions.",
                "2. Event Identification: Aggregate completions by District + Date; flag dates exceeding threshold.",
                "3. Spike & Boost Computation: Compute Spike Ratio, March-end boosts, and category diversity ratio.",
                "4. MP Batch Check: Group completions by MP + Date; flag MPs with >= 8 completions.",
                "5. Mitigations: Apply supply keyword factor (0.70x) and quarter-end factor (0.80x).",
                "6. Persist Anomalies: Store spike ratio, completion date, district, and constituent work IDs."
            ]
        },
        {
            "num": 9,
            "name": "Round-Number Screen & Benford's Law Analysis",
            "type": "Forensic Number Analysis & Statistical Goodness-of-Fit",
            "purpose": (
                "Identifies manufactured or fabricated budget allocations by checking whether project cost figures follow natural logarithmic digit distributions "
                "(Benford's Law) or exhibit abnormal clustering at exact round-number amounts."
            ),
            "features": [
                "First Significant Digit (1–9): Extracted from non-zero project costs and compared against Benford's distribution (log10(1 + 1/d)).",
                "Second Significant Digit (0–9): Evaluated when sample sizes are sufficiently large (>= 60 works).",
                "Roundness Level Classification: Level 0 (not round), Level 1 (₹10k), Level 2 (₹50k), Level 3 (₹1L), Level 4 (₹5L), Level 5 (₹10L).",
                "Multiple Testing Correction: Bonferroni correction applied across MP portfolio Chi-Square tests."
            ],
            "rules": [
                "Sample Size Guardrails: Requires >= 45 works for 1st-digit Benford Chi-Square test; >= 60 works for 2nd-digit test. Below 45, Benford analysis is bypassed.",
                "Benford Violation Criteria: Adjusted p-value < 0.05 AND First-Digit Deviation > 0.15, OR Second-Digit adjusted p-value < 0.05.",
                "Round-Number Concentration: Portfolio % of works at Level >= 3 (₹1 Lakh+ multiples). Severity reference: 20% (0.50), 35% (0.70), 50% (0.90).",
                "Work-Level Flagging: Evaluated if project is Level >= 4 (exact ₹5L or ₹10L multiple) OR MP portfolio exhibits >= 30% exact-lakh concentration."
            ],
            "severity": "Base 0.50, +0.20 for Level 5 (exact ₹10L), compounded with MP portfolio roundness severity and Benford violation signal.",
            "mitigation": "A single round project is never flagged on its own; anomalies require corroboration from the parliamentarian's macro-portfolio distribution.",
            "workflow": [
                "1. Filter Positive Costs: Retain works with Cost > 0; extract 1st and 2nd digits and roundness levels (0–5).",
                "2. MP Portfolio Test: Group by MP (>= 45 works); compute Chi-Square test against Benford probabilities.",
                "3. Round Ratio Calculation: Compute % of MP works with roundness Level >= 3.",
                "4. Bonferroni Adjustment: Adjust p-values for family-wise error rate; flag Benford violations.",
                "5. Project Screening: Flag Level 4/5 works or works in >=30% round portfolios.",
                "6. Evidence Assembly: Store digits, round level, Chi-Square statistic, p-value, and persist."
            ]
        },
        {
            "num": 10,
            "name": "Vague Description Flag (Text Forensics)",
            "type": "Natural Language Engineering Specificity Scoring",
            "purpose": (
                "Screens project documentation to flag missing, excessively brief, boilerplate, or uninformative project scopes, "
                "enforcing the statutory principle that substantial public expenditure requires proportional engineering detail."
            ),
            "features": [
                "Character Length Gates: Tiered thresholds based on project capital commitment.",
                "Generic Boilerplate Phrases: Detection of uninformative phrases ('development work', 'various works', 'miscellaneous', 'general development').",
                "5-Dimensional Specificity Score: Weighted metrics for Measurements (0.25), Location Specifics (0.25), Technical Specifications (0.20), Work Scope Action (0.15), and Beneficiary Target (0.15).",
                "Corpus Template Repetition: Tracks identical description strings occurring >= 10 times across unrelated works."
            ],
            "rules": [
                "Critical Missing Description: Empty, 'Not specified', 'None', or 'nan' immediately flagged with Critical severity (1.00).",
                "Cost Exemption Floor: Projects < ₹2,00,000 are completely exempt from normal vagueness screening.",
                "High-Cost Length Rules (>= ₹5 Lakh): Length < 25 chars -> Severity 0.85; 25–49 chars -> Severity 0.70.",
                "Medium-Cost Length Rules (₹2L–₹5L): Length < 20 chars -> Severity 0.75; 20–39 chars -> Severity 0.60.",
                "Specificity Deficit: Score < 0.12 triggers low_specificity (0.80); Score < 0.20 for >=₹5L triggers substandard_specificity (0.60).",
                "Template Repetition: Exact string repeated >= 10 times triggers template_repetition (0.50 to 0.85).",
                "Signal Compounding: Final Severity = Max(Individual Signals) + 0.15 * (Signal Count - 1), capped at 1.00."
            ],
            "severity": "Combines length, generic phrasing, low specificity, and template reuse, with missing descriptions receiving automatic 1.00.",
            "mitigation": "Small capital works (<₹2 Lakh) are exempted; standard engineering vocabulary (RCC, M20, chainage, village names) directly boosts the specificity score.",
            "workflow": [
                "1. Null Check: Flag missing descriptions with severity 1.00.",
                "2. Cost Exemption: Skip projects with Cost < ₹2,00,000.",
                "3. Character Length Evaluation: Assess length against ₹5L and ₹2L thresholds.",
                "4. Boilerplate Scan: Search for generic phrases ('development work', 'various works').",
                "5. Specificity Evaluation: Calculate weighted score across 5 engineering dimensions.",
                "6. Template Frequency: Count exact matches across corpus; flag count >= 10.",
                "7. Composite Severity: Merge signals (Max + 0.15 per additional), filter by floor, and persist."
            ]
        },
        {
            "num": 11,
            "name": "Category-Amount Mismatch (Physical Engineering Plausibility)",
            "type": "Engineering Economics & Feasibility Ceilings",
            "purpose": (
                "Screens project budgets against physical engineering plausibility limits to identify expenditures that are either "
                "implausibly exorbitant (e.g. ₹28 Lakh for a single handpump) or impossibly inadequate (e.g. ₹45,000 for an entire school building)."
            ),
            "features": [
                "Standard Engineering Feasibility Schedule: Predefined minimum and maximum unit costs for 7 core categories: School Building (₹5L–₹2Cr), Community Hall (₹3L–₹1.5Cr), Handpump (₹25k–₹1L), Overhead Tank (₹4L–₹30L), Compound Wall (₹50k–₹50L), Street Lights (₹3k–₹35k), CC Roads (₹50k–₹2.5Cr).",
                "Dynamic Price Master Override: Seamless override via unit_prices_master.csv when available.",
                "Category Inference NLP: Maps generic classifications ('Others') to verified categories via keyword parsing (e.g. 'classroom', 'borewell', 'LED light').",
                "Quantity Extraction: Parses quantity from description; defaults to 1 unit if unstated."
            ],
            "rules": [
                "Feasible Range Bounds: Effective Minimum = Unit Min x Quantity; Effective Maximum = Unit Max x Quantity.",
                "Implausibly Low Check: Actual Cost < Effective Minimum -> Flagged. Ratio = Min / Cost. Severity: 1.0x (0.50), 5.0x (0.85), 10.0x (1.00).",
                "Implausibly High Check: Actual Cost > Effective Maximum -> Flagged. Ratio = Cost / Max. Severity: 1.0x (0.50), 3.0x (0.80), 5.0x (1.00)."
            ],
            "severity": "Calculated monotonically from the deviation ratio outside permissible engineering bounds, capped at 1.00.",
            "mitigation": "Projects lacking recognizable category keywords are safely skipped rather than evaluated against arbitrary thresholds.",
            "workflow": [
                "1. Load Schedules: Ingest default bounds and apply unit_prices_master.csv overrides if present.",
                "2. Category & Quantity Parsing: Normalize category from text keywords and extract quantity (default 1).",
                "3. Bound Calculation: Multiply unit min/max by quantity to establish project-level feasible envelope.",
                "4. Plausibility Check: Test if Cost < Effective Min (low) OR Cost > Effective Max (high).",
                "5. Severity Mapping: Compute deviation ratio and map to monotonic severity.",
                "6. Output: Record deviation ratio, category, feasible bounds, and persist Anomaly record."
            ]
        },
        {
            "num": 12,
            "name": "Verification Gap Flag (Macro vs Micro Ledger Reconciliation)",
            "type": "Forensic Accounting & Ledger Auditing",
            "purpose": (
                "Reconciles bottom-up completed project expenditure against top-down MP-level official financial ledgers, "
                "identifying discrepancies between project claims and statutory accounts as well as severe disbursement deficits."
            ),
            "features": [
                "Official Financial Ledger Integration: Ingests all_mps_financial_breakdown.csv containing official completed works value, allocation, and portfolio payment gap.",
                "Database Project Aggregation: Bottom-up summation of all completed project costs for each parliamentarian.",
                "Divergence Ratio: Bottom-up Database Project Sum divided by Official Ledger Completed Value.",
                "Disbursement Deficit Triangulation: Ratio of verified paid amount to project cost evaluated against macro portfolio payment gaps."
            ],
            "rules": [
                "MP-Level Ledger Divergence: Triggered when Database Project Sum exceeds Ledger Completed Value by > 15% (Divergence Ratio > 1.15). Severity scale: 1.15x (0.50), 1.50x (0.70), 2.50x (1.00). Attributed to all constituent works.",
                "Work-Level Disbursement Deficit: Triggered when: Verified payment record exists AND Disbursement Ratio < 25% AND MP Portfolio Payment Gap >= 60%. Severity scales with (1 - Disbursement Ratio).",
                "Composite Selection: Final Severity = Max(MP Divergence Severity, Work Deficit Severity)."
            ],
            "severity": "Takes the higher of the macro ledger divergence or micro disbursement deficit severity. Filtered by SEVERITY_FLOOR.",
            "mitigation": "Missing payment records are never treated as ₹0 paid, preventing data-pipeline ingestion delays from being misidentified as accounting fraud.",
            "workflow": [
                "1. Ingest Official Ledger: Load MP financial breakdown schedule into lookup map.",
                "2. Bottom-up Summation: Aggregate costs of completed works per MP.",
                "3. Divergence Test: If Database Sum / Ledger Value > 1.15, compute MP divergence severity.",
                "4. Work-Level Audit: For each completed work, check payment existence, disbursement ratio (<25%), and MP gap (>=60%).",
                "5. Composite Resolution: Take Max(Divergence, Deficit) severity.",
                "6. Save: Persist verification gap anomaly with divergence ratio, ledger values, and disbursement metrics."
            ]
        },
        {
            "num": 13,
            "name": "Implementing District Authority (IDA) Risk Profiler",
            "type": "Hierarchical Empirical Bayes Entity Risk Aggregator",
            "purpose": (
                "Aggregates project-level anomaly signals across all detectors to compute a unified, statistically robust "
                "composite risk score and relative percentile tier for each Implementing District Authority (IDA)."
            ),
            "features": [
                "Cross-Detector Anomaly Synthesis: Ingests anomaly outputs from Detectors 1 through 12 for the current run.",
                "Unique Flagged Project Rate: Unique flagged works divided by total district works (prevents double-counting).",
                "Weighted Detector Violations: Incorporates detector-specific violation rates, mean severities, and ENTITY_RISK_WEIGHTS.",
                "Empirical Bayes Shrinkage (m=30): Adjusts district scores toward the national mean to stabilize small-sample districts."
            ],
            "rules": [
                "Raw Risk Score Formula: Sum of (Violation Rate x 100 x Mean Severity x Detector Weight) across all detectors, capped at 100.",
                "Empirical Bayes Shrinkage Formula: Shrunk Risk = Raw Risk * [N / (N + 30)] + National Mean * [30 / (N + 30)], where N is total district works.",
                "Relative Percentile Tiers: Top 10% of districts by shrunk risk -> Critical; Next 20% (10%–30%) -> High; Next 30% (30%–60%) -> Medium; Remaining 40% -> Clean."
            ],
            "severity": "Continuous composite score (0–100) representing shrunk systemic risk, converted into relative administrative tiers.",
            "mitigation": "Empirical Bayes shrinkage prevents small districts with few projects from artificially dominating the Critical tier due to high raw percentages.",
            "workflow": [
                "1. Data Integration: Left-join works and anomalies for the active run ID.",
                "2. District Aggregation: Compute total works, total expenditure, and unique flagged works.",
                "3. Detector Breakdown: For each detector, compute violation rate, mean severity, and weighted contribution.",
                "4. Raw Risk Summation: Calculate weighted raw risk score (capped at 100).",
                "5. Empirical Bayes Shrinkage: Calculate national mean risk and apply m=30 shrinkage formula.",
                "6. Percentile Ranking: Rank districts descending by shrunk risk; assign Critical, High, Medium, or Clean tiers.",
                "7. Persist Profile: Store EntityRisk record (entity_type='ida') with detailed detector breakdown JSON."
            ]
        },
        {
            "num": 14,
            "name": "MP & Constituency Risk Profiler",
            "type": "Hierarchical Empirical Bayes Portfolio Risk Aggregator",
            "purpose": (
                "Synthesizes anomaly results across an entire parliamentarian's project portfolio, evaluating the breadth, frequency, "
                "and severity of irregular patterns to establish an executive risk index and comparative ranking."
            ),
            "features": [
                "Constituency & MP Binding: Maps all recommended works to the sponsoring MP and constituency.",
                "Multi-Signal Portfolio Profiling: Integrates duplicate works, cost overruns, smurfing, delays, Benford violations, and timing anomalies.",
                "Weighted Portfolio Score: Incorporates detector-specific violation frequencies, average severities, and configured weights.",
                "Empirical Bayes Shrinkage (m=20): Stabilizes risk scores for parliamentarians with small total numbers of recommended works."
            ],
            "rules": [
                "Raw Portfolio Score: Sum of (Violation Rate x 100 x Mean Severity x Detector Weight), capped at 100.",
                "Empirical Bayes Formula: Shrunk Risk = Raw Risk * [N / (N + 20)] + National MP Mean * [20 / (N + 20)], where N is total MP works.",
                "Relative Percentile Tiers: Top 10% of MPs by shrunk risk -> Critical; Next 20% (10%–30%) -> High; Next 30% (30%–60%) -> Medium; Remaining 40% -> Clean."
            ],
            "severity": "Composite score (0–100) scaled via Empirical Bayes shrinkage, mapped to relative percentile tiers.",
            "mitigation": "Small portfolios (e.g. newly elected MPs with < 10 works) are prevented from receiving distorted Critical ratings via m=20 shrinkage.",
            "workflow": [
                "1. Ingest Data: Merge work records and active run anomalies by work_id.",
                "2. Portfolio Aggregation: Group records by MP name; calculate total works, expenditure, and unique flagged works.",
                "3. Detector Synthesis: Calculate violation rates, mean severities, and weighted scores per detector.",
                "4. Raw Score Capping: Sum detector contributions and cap at 100.",
                "5. Bayes Shrinkage: Compute national MP average and apply m=20 shrinkage formula.",
                "6. Percentile Ranking: Rank MPs descending by shrunk risk; assign Critical/High/Medium/Clean tiers.",
                "7. EntityRisk Persistence: Save EntityRisk record (entity_type='mp') with constituency and detector breakdown."
            ]
        },
        {
            "num": 15,
            "name": "Copy-Paste Pricing (Cloned Estimates Forensics)",
            "type": "Combinatorial Pricing & Template Replication Analysis",
            "purpose": (
                "Identifies cloned, copy-pasted, or template budgeting where unrelated projects under the same MP share identical "
                "total project costs across different categories, or share identical rounded unit rates within the same category."
            ),
            "features": [
                "Cross-Category Cost Clustering: Groups works by MP + Exact Rounded Cost across multiple distinct categories.",
                "High-Confidence Unit Rate Extraction: Reuses CPWD NLP parsing to compute unit rate (Cost / Quantity) with high confidence.",
                "Unit Rate Rounding: Rounds calculated unit rates to the nearest ₹100 to catch clustered estimates.",
                "Category-Specific Unit Rate Clustering: Evaluates repeated unit pricing within the same MP and category."
            ],
            "rules": [
                "Signal 1 (Cross-Category Exact Cost Clone): Triggered when >= 5 works under the same MP share the exact same cost AND span > 1 category. Severity scale: 5 works (0.75), 10 works (0.88), 20 works (0.98).",
                "Signal 2 (Cloned Unit Rate): Triggered when >= 5 works under the same MP and category share the identical rounded unit rate (to nearest ₹100) with high extraction confidence. Severity scale: 5 repeats (0.50), 10 repeats (0.70), 20 repeats (0.90).",
                "Composite Selection: Final Severity = Max(Cross-Category Severity, Cloned Unit Rate Severity)."
            ],
            "severity": "Derived from the higher of the cross-category or unit-rate repetition severity curves. Filtered by SEVERITY_FLOOR.",
            "mitigation": "Single-category identical costs (e.g. 5 identical road segments) do not trigger cross-category alerts; unit-rate checks strictly require high-confidence text extraction.",
            "workflow": [
                "1. Cross-Category Grouping: Group works by MP + Cost; flag groups with >= 5 works and > 1 category.",
                "2. Physical Parsing: Extract benchmark type, unit type, and quantity (filter for high confidence).",
                "3. Unit Rate Rounding: Compute Cost / Quantity; round to nearest ₹100.",
                "4. Unit Rate Grouping: Group by MP + Category + Rounded Unit Rate; flag groups with >= 5 works.",
                "5. Work Evaluation: For each work, check cross-category clone and cloned unit rate; select max severity.",
                "6. Anomaly Persistence: Store exact repeat count, unit rate, category count, and persist Anomaly record."
            ]
        }
    ]

    for det in detectors_content:
        # Heading 1 for Detector
        h1 = doc.add_heading(level=1)
        r_h1 = h1.add_run(f"Detector {det['num']:02d}: {det['name']}")
        r_h1.font.name = 'Arial'
        r_h1.font.size = Pt(13)
        r_h1.font.bold = True
        r_h1.font.color.rgb = RGBColor(15, 23, 42)
        h1.paragraph_format.space_before = Pt(12)
        h1.paragraph_format.space_after = Pt(2)

        # Meta tag
        p_type = doc.add_paragraph()
        p_type.paragraph_format.space_after = Pt(4)
        r_type_label = p_type.add_run("Analytical Domain: ")
        r_type_label.bold = True
        r_type_label.font.size = Pt(9)
        r_type_label.font.color.rgb = RGBColor(71, 85, 105)
        r_type_val = p_type.add_run(det['type'])
        r_type_val.font.size = Pt(9)
        r_type_val.font.color.rgb = RGBColor(30, 58, 138)

        # Core Purpose
        p_p = doc.add_paragraph()
        r_p_lbl = p_p.add_run("Core Purpose & Threat Model: ")
        r_p_lbl.bold = True
        p_p.add_run(det['purpose'])

        # Features / Data Inputs
        p_f_lbl = doc.add_paragraph()
        r_f_lbl = p_f_lbl.add_run("Key Features & Analytical Inputs:")
        r_f_lbl.bold = True
        p_f_lbl.paragraph_format.space_after = Pt(2)
        for feat in det['features']:
            p_f = doc.add_paragraph(style='List Bullet')
            p_f.paragraph_format.space_after = Pt(2)
            parts = feat.split(":", 1)
            if len(parts) == 2:
                r_k = p_f.add_run(parts[0] + ":")
                r_k.bold = True
                p_f.add_run(parts[1])
            else:
                p_f.add_run(feat)

        # Operational Rules & Thresholds
        p_r_lbl = doc.add_paragraph()
        r_r_lbl = p_r_lbl.add_run("Operational Rules, Parameters & Thresholds:")
        r_r_lbl.bold = True
        p_r_lbl.paragraph_format.space_after = Pt(2)
        for rule in det['rules']:
            p_r = doc.add_paragraph(style='List Bullet')
            p_r.paragraph_format.space_after = Pt(2)
            parts = rule.split(":", 1)
            if len(parts) == 2:
                r_k = p_r.add_run(parts[0] + ":")
                r_k.bold = True
                p_r.add_run(parts[1])
            else:
                p_r.add_run(rule)

        # Severity & Scoring
        p_sev = doc.add_paragraph()
        r_sev_lbl = p_sev.add_run("Severity Formulation: ")
        r_sev_lbl.bold = True
        p_sev.add_run(det['severity'])

        # False-Positive Mitigation Box
        add_callout(doc, det['mitigation'], alert_type="CAUTION")

        # Step-by-Step Workflow
        p_w_lbl = doc.add_paragraph()
        r_w_lbl = p_w_lbl.add_run("End-to-End Execution Pipeline:")
        r_w_lbl.bold = True
        p_w_lbl.paragraph_format.space_after = Pt(2)
        for step in det['workflow']:
            p_step = doc.add_paragraph(style='List Number')
            p_step.paragraph_format.space_after = Pt(2)
            # Remove leading digit if present
            s_clean = step.lstrip("0123456789. ")
            p_step.add_run(s_clean)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Save to path
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    out = "/Users/suvendu/Downloads/SIH-DATA/SATARK_MPLADS_15_Detectors_Specification.docx"
    build_word_document(out)
