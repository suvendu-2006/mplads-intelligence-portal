#!/usr/bin/env python3
"""
Generates a 5-page PDF explaining all 15 SATARK detectors in dead-simple,
human language that literally anyone can understand.
"""

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas


def xs(text):
    """Escape < > & for ReportLab XML while keeping <b> and <i> tags."""
    text = str(text)
    text = text.replace('<b>', '\x00B').replace('</b>', '\x00b')
    text = text.replace('<i>', '\x00I').replace('</i>', '\x00i')
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace('\x00B', '<b>').replace('\x00b', '</b>')
    text = text.replace('\x00I', '<i>').replace('\x00i', '</i>')
    return text


class FooterCanvas(canvas.Canvas):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._pages)
        for s in self._pages:
            self.__dict__.update(s)
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#94A3B8"))
            self.drawString(42, 22, "SATARK MPLADS - Detector Reference Guide")
            self.drawRightString(8.5*72 - 42, 22, f"Page {self._pageNumber} of {n}")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.line(42, 30, 8.5*72 - 42, 30)
            super().showPage()
        super().save()


def go(out_path):
    doc = SimpleDocTemplate(out_path, pagesize=letter,
                            leftMargin=42, rightMargin=42,
                            topMargin=36, bottomMargin=36)
    S = getSampleStyleSheet()

    # Styles
    title = ParagraphStyle('T', parent=S['Normal'], fontName='Helvetica-Bold',
                           fontSize=16, leading=20, textColor=colors.HexColor("#0F172A"), spaceAfter=2)
    subtitle = ParagraphStyle('ST', parent=S['Normal'], fontName='Helvetica',
                              fontSize=9.5, leading=13, textColor=colors.HexColor("#475569"), spaceAfter=8)
    heading = ParagraphStyle('H', parent=S['Normal'], fontName='Helvetica-Bold',
                             fontSize=12, leading=15, textColor=colors.HexColor("#1E3A8A"),
                             spaceBefore=10, spaceAfter=4)
    det_name = ParagraphStyle('DN', parent=S['Normal'], fontName='Helvetica-Bold',
                              fontSize=10.5, leading=14, textColor=colors.HexColor("#0F172A"),
                              spaceBefore=8, spaceAfter=1)
    body = ParagraphStyle('B', parent=S['Normal'], fontName='Helvetica',
                          fontSize=9, leading=12.5, textColor=colors.HexColor("#1E293B"), spaceAfter=3)
    bullet = ParagraphStyle('BL', parent=S['Normal'], fontName='Helvetica',
                            fontSize=8.5, leading=11.5, textColor=colors.HexColor("#334155"),
                            leftIndent=12, firstLineIndent=-8, spaceAfter=1.5)
    note = ParagraphStyle('N', parent=S['Normal'], fontName='Helvetica-Oblique',
                          fontSize=8, leading=11, textColor=colors.HexColor("#64748B"), spaceAfter=2)
    th = ParagraphStyle('TH', parent=S['Normal'], fontName='Helvetica-Bold',
                        fontSize=8, leading=10, textColor=colors.white)
    td = ParagraphStyle('TD', parent=S['Normal'], fontName='Helvetica',
                        fontSize=7.5, leading=9.5, textColor=colors.HexColor("#1E293B"))
    tdb = ParagraphStyle('TDB', parent=S['Normal'], fontName='Helvetica-Bold',
                         fontSize=7.5, leading=9.5, textColor=colors.HexColor("#0F172A"))

    P = lambda t, s: Paragraph(xs(t), s)
    story = []

    # ======================== PAGE 1 ========================
    story.append(P("How SATARK Catches Problems in MPLADS Projects", title))
    story.append(P(
        "This guide explains, in plain and simple words, how our system checks government projects for "
        "possible problems. There are 15 different checks. Each one looks at a different angle. "
        "Think of them like 15 different inspectors, each with their own specialty.",
        subtitle
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1E3A8A"),
                            spaceBefore=0, spaceAfter=6))

    story.append(P(
        "<b>One important thing before we start:</b> When the system flags a project, it does NOT mean "
        "someone stole money. It means something looks odd and needs a closer look. Maybe there is a good reason. "
        "Maybe there isn't. These flags just tell the auditor where to pay attention first.",
        body
    ))
    story.append(Spacer(1, 4))

    # Quick overview table
    story.append(P("Quick Overview - All 15 Checks at a Glance", heading))

    tdata = [
        [P("#", th), P("Check Name", th), P("What It Does (In One Line)", th)]
    ]
    overview = [
        ("01", "Unusual Pattern", "Finds projects that look weird compared to similar ones nearby."),
        ("02", "Duplicate Work", "Catches the same work written twice under different names."),
        ("03", "Cost Overrun", "Checks if the price paid is way higher than the government rate."),
        ("04", "Ghost Works", "Finds 'completed' projects where no money was actually paid out."),
        ("05", "Bill Splitting", "Catches big projects chopped into small ones to dodge tender rules."),
        ("06", "Delays & Stalled", "Flags projects stuck for over a year with no progress."),
        ("07", "Timing Tricks", "Spots suspicious rushes in March or right before elections."),
        ("08", "Bulk Sign-Off", "Catches 20-30 projects magically completed on the same day."),
        ("09", "Round Numbers", "Flags if too many budgets are suspiciously round (Rs. 5 Lakh exact)."),
        ("10", "Vague Description", "Flags expensive projects described as just 'development work'."),
        ("11", "Cost vs Reality", "Checks if Rs. 28 Lakh for one handpump makes any physical sense."),
        ("12", "Ledger Mismatch", "Compares project records with official financial books."),
        ("13", "District Score", "Gives each district an overall risk score based on all checks."),
        ("14", "MP Score", "Gives each MP's portfolio an overall risk score."),
        ("15", "Copy-Paste Pricing", "Finds identical budgets reused across totally different projects."),
    ]
    for num, name, desc in overview:
        tdata.append([P(num, tdb), P(name, tdb), P(desc, td)])

    t = Table(tdata, colWidths=[24, 105, 399])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ======================== PAGE 2: DETECTORS 1-5 ========================
    story.append(P("Checks 1 to 5: Finding Weird Projects, Duplicates, Overpricing, Ghost Works & Bill Splitting", heading))

    # D-01
    story.append(P("Check 1: Unusual Pattern Detection", det_name))
    story.append(P(
        "Imagine you have 500 road projects in a district. Most of them cost Rs. 10-15 Lakh and take "
        "6-8 months to finish. Now one project costs Rs. 50 Lakh and was apparently finished in 5 days. "
        "That one stands out like a sore thumb, right? That is exactly what this check does.",
        body
    ))
    story.append(P(
        "It looks at 6 things about each project - cost, how long it took, what month it finished, "
        "and how different its cost is from similar projects. If a project is extremely different on "
        "multiple of these measures at once, it gets flagged.",
        body
    ))
    story.append(P("- Needs at least 50 completed projects to even start (otherwise the math is unreliable).", bullet))
    story.append(P("- A flag here means 'statistically unusual', not 'definitely corrupt'. Could be a flood relief project that genuinely cost more.", bullet))

    # D-02
    story.append(P("Check 2: Duplicate Work Detection", det_name))
    story.append(P(
        "Sometimes the exact same road or building shows up twice in the records, just worded slightly differently. "
        "Like 'Construction of CC road near Shiva temple, Ward 4' and 'CC road construction adjacent to Shiva Mandir, "
        "Ward No. 4'. Same road. Different words.",
        body
    ))
    story.append(P(
        "This check uses AI to understand the meaning behind the words, not just the exact letters. "
        "It compares every project description with every other project in the same district. "
        "If two descriptions are more than 93-95% similar in meaning, and the costs are in the same "
        "ballpark (within 70% to 143% of each other), it flags them as possible duplicates.",
        body
    ))
    story.append(P("- Only compares projects within the same district (two similar roads in different districts is totally normal).", bullet))
    story.append(P("- Very short descriptions (under 20 characters) are skipped because there is not enough text to compare.", bullet))
    story.append(P("- Common template phrases that appear 10+ times are ignored - those are just standard admin text.", bullet))

    # D-03
    story.append(P("Check 3: Cost Overrun Detection", det_name))
    story.append(P(
        "The government publishes official rate lists for construction work (called CPWD DSR 2023). "
        "For example, a CC road should cost roughly Rs. 3,500 per metre. This check compares "
        "what was actually billed against what the official rate says it should cost.",
        body
    ))
    story.append(P(
        "But it is not rigid about it. It adds a 25% general buffer (because real-world costs vary), "
        "another 15% for hilly or remote areas, and 6% extra for every year after 2023 (inflation). "
        "Even after all those generous adjustments, if the billed rate is still more than 5% above "
        "the ceiling AND the excess amount is at least Rs. 10,000, only then it flags it.",
        body
    ))

    # D-04
    story.append(P("Check 4: Ghost Works Detection", det_name))
    story.append(P(
        "This one is straightforward. If a project is marked 'completed' in the records, but the "
        "payment ledger shows that zero rupees were actually paid out - that is a red flag. "
        "A finished building should have been paid for.",
        body
    ))
    story.append(P("- If the project was completed less than 30 days ago, the system goes easy on it (maybe the payment is still processing).", bullet))
    story.append(P("- If the payment record itself is missing (not Rs. 0, but actually missing from the database), the system treats it as 'we don't know' rather than 'definitely fraud'.", bullet))
    story.append(P("- Small projects under Rs. 50,000 get a lower severity score.", bullet))

    # D-05
    story.append(P("Check 5: Bill Splitting (Smurfing)", det_name))
    story.append(P(
        "Government rules say that if a project costs more than Rs. 5 Lakh, you need to float an open tender. "
        "Above Rs. 20 Lakh, you need special technical approval. So what if someone splits a Rs. 20 Lakh "
        "road into four Rs. 4.9 Lakh pieces to avoid the tender process?",
        body
    ))
    story.append(P(
        "This check looks for clusters of projects by the same MP, in the same month, all priced "
        "suspiciously close to but just under Rs. 5 Lakh (between Rs. 4.5 Lakh and Rs. 4.99 Lakh). "
        "If there are 3 or more such projects in one month, it raises a flag. Same logic applies for "
        "the Rs. 20 Lakh threshold.",
        body
    ))
    story.append(P("- Isolated cases are ignored. You need a pattern - multiple contracts, same MP, same month, same price range.", bullet))

    story.append(PageBreak())

    # ======================== PAGE 3: DETECTORS 6-10 ========================
    story.append(P("Checks 6 to 10: Delays, Suspicious Timing, Bulk Sign-offs, Round Numbers & Vague Descriptions", heading))

    # D-06
    story.append(P("Check 6: Delays and Stalled Works", det_name))
    story.append(P(
        "Government guidelines say a project should be completed within 1 year (365 days) of being approved. "
        "This check looks for projects that have blown past that deadline.",
        body
    ))
    story.append(P(
        "If a project has been sitting for 2 years with no completion, that is more serious than one "
        "that is just a few months late. The severity goes up the longer the delay: 1 year overdue is "
        "moderate, 2 years is high, 3+ years is critical.",
        body
    ))
    story.append(P("- Big multi-phase projects (the description mentions 'phase', 'stage', or 'package') get some leniency because they genuinely take longer.", bullet))

    # D-07
    story.append(P("Check 7: Suspicious Timing (March Dumping & Election Rush)", det_name))
    story.append(P(
        "The financial year ends on March 31. If an MP completes barely any projects all year but "
        "suddenly 'finishes' 60% of them in March alone, that pattern deserves a second look. "
        "Similarly, if an MP's project completion rate suddenly jumps 5-10x in the last 6 months "
        "before an election, that is also worth investigating.",
        body
    ))
    story.append(P("- The system weighs spending (60%) more than project count (40%), so completing 10 small Rs. 50k projects in March is less suspicious than dumping Rs. 5 Crore.", bullet))
    story.append(P("- For election rush, it needs at least 5 projects in the baseline period to compare against.", bullet))

    # D-08
    story.append(P("Check 8: Same-Day Bulk Completion", det_name))
    story.append(P(
        "A district normally completes 1-2 projects per week. One fine day, 42 projects are all signed "
        "off as completed. That is physically very hard to believe - someone would have had to inspect "
        "42 different construction sites in a single day.",
        body
    ))
    story.append(P(
        "The system calculates what is normal for each district and flags days where completions "
        "spike to 10x, 20x, or even 50x the usual rate. March 31 gets extra scrutiny.",
        body
    ))
    story.append(P("- Bulk supply items (like 50 street lights delivered and installed together) are given a 30% discount because batch delivery is genuinely normal for those.", bullet))

    # D-09
    story.append(P("Check 9: Round Numbers and Benford's Law", det_name))
    story.append(P(
        "In real life, when engineers calculate project costs, they get messy numbers like Rs. 3,78,420 "
        "or Rs. 7,12,850. If an MP's projects are overwhelmingly budgeted at exact round figures - "
        "Rs. 5,00,000 exactly, Rs. 10,00,000 exactly, over and over - that suggests the estimates "
        "might not be based on actual engineering calculations.",
        body
    ))
    story.append(P(
        "The system also uses something called Benford's Law, which is a mathematical pattern that "
        "naturally occurring numbers follow. Made-up numbers usually don't follow this pattern. "
        "The system checks if an MP's cost figures follow this natural distribution or not.",
        body
    ))
    story.append(P("- A single round-number project is perfectly fine. The flag only triggers when a large chunk of an MP's portfolio (30%+) uses exact round numbers.", bullet))
    story.append(P("- Needs at least 45 projects in the portfolio to run the Benford test (with fewer, the math is not reliable).", bullet))

    # D-10
    story.append(P("Check 10: Vague Description Flag", det_name))
    story.append(P(
        "If a project costs Rs. 20 Lakh, you would expect the description to say something like "
        "'Construction of 200m RCC road from Main Road to Primary School in XYZ village'. "
        "But some entries just say 'Development work' or 'Miscellaneous'. That tells you absolutely nothing.",
        body
    ))
    story.append(P(
        "This check scores descriptions on how specific they are - do they mention measurements? "
        "A location? Technical details? The more expensive the project, the more detail is expected.",
        body
    ))
    story.append(P("- Projects under Rs. 2 Lakh are exempt (small works don't always need elaborate descriptions).", bullet))
    story.append(P("- If the exact same description appears in 10+ different projects, it is flagged as copy-paste boilerplate.", bullet))

    story.append(PageBreak())

    # ======================== PAGE 4: DETECTORS 11-15 ========================
    story.append(P("Checks 11 to 15: Impossible Costs, Ledger Gaps, District Scores, MP Scores & Copy-Paste Pricing", heading))

    # D-11
    story.append(P("Check 11: Category-Amount Mismatch", det_name))
    story.append(P(
        "Some things just cannot cost what the records say. A handpump costs Rs. 25,000 to Rs. 1 Lakh. "
        "If someone records Rs. 28 Lakh for installing a single handpump, that is physically impossible. "
        "Similarly, you cannot build an entire school for Rs. 45,000.",
        body
    ))
    story.append(P(
        "The system has common-sense price ranges for 7 types of works (schools, community halls, "
        "handpumps, overhead tanks, compound walls, street lights, and roads). If a project's cost "
        "falls way outside these ranges, it gets flagged.",
        body
    ))
    story.append(P("- If the system cannot figure out what type of work a project is, it simply skips it rather than making a wrong guess.", bullet))

    # D-12
    story.append(P("Check 12: Verification Gap (Ledger Mismatch)", det_name))
    story.append(P(
        "The government keeps two records. One is the list of individual projects and their costs. "
        "The other is the official financial ledger that tracks total money spent. These two should "
        "roughly match. If the project database says Rs. 14.5 Crore worth of projects are completed, "
        "but the official ledger says only Rs. 8 Crore, that is a big gap worth investigating.",
        body
    ))
    story.append(P("- A small gap (under 15%) is tolerated because timing differences in accounting are normal.", bullet))
    story.append(P("- The system also checks individual projects where less than 25% of the cost was actually paid out.", bullet))

    # D-13
    story.append(P("Check 13: District Risk Score", det_name))
    story.append(P(
        "After running all 12 checks above, the system asks: 'Overall, how problematic is this district?' "
        "It adds up how many projects were flagged, by which detectors, and how severe those flags were. "
        "Then it ranks all districts against each other.",
        body
    ))
    story.append(P(
        "The top 10% of districts get labeled 'Critical'. The next 20% are 'High Risk'. The next 30% "
        "are 'Medium'. The remaining 40% are 'Clean'.",
        body
    ))
    story.append(P("- Small districts with only a handful of projects are pulled toward the national average (a statistical technique called shrinkage) so that one bad project does not make an entire district look terrible.", bullet))

    # D-14
    story.append(P("Check 14: MP Portfolio Risk Score", det_name))
    story.append(P(
        "Same idea as the district score, but applied to individual MPs. It looks at all projects "
        "recommended by a particular MP, counts how many were flagged and how severely, and produces "
        "a single risk score. MPs are then ranked: Top 10% Critical, next 20% High, and so on.",
        body
    ))
    story.append(P("- New MPs with very few projects are also pulled toward the average so that one or two flags do not unfairly put them at the top of the risk list.", bullet))

    # D-15
    story.append(P("Check 15: Copy-Paste Pricing", det_name))
    story.append(P(
        "Different projects should normally have different costs. A road costs differently from a "
        "school, which costs differently from a water tank. If the same MP has 6 projects - a road, "
        "a school, a water project, a lighting project, a community hall, and a drainage work - all "
        "budgeted at exactly Rs. 10,00,000, that looks like someone just copy-pasted the same number.",
        body
    ))
    story.append(P(
        "The system also checks for repeated unit rates. If an MP has 8 road projects all costing "
        "exactly Rs. 5,000 per metre (rounded to the nearest Rs. 100), that is suspicious too.",
        body
    ))
    story.append(P("- Needs at least 5 identical amounts across more than 1 category to trigger the cross-category flag.", bullet))
    story.append(P("- Multiple identical road segments (same category) do NOT trigger the cross-category check. Only the unit rate check applies there.", bullet))

    story.append(PageBreak())

    # ======================== PAGE 5: HOW TO READ + SEVERITY ========================
    story.append(P("How to Read the Results & What the Scores Mean", heading))

    story.append(P(
        "Every flagged project gets a <b>severity score</b> between 0.00 and 1.00. Think of it "
        "like a thermometer. The higher the number, the more attention it needs.",
        body
    ))

    sev_data = [
        [P("Score Range", th), P("What It Means", th), P("What Should Happen", th)],
        [P("0.85 - 1.00", tdb), P("Something looks very wrong.", td),
         P("Send someone to physically inspect the site. Urgently.", td)],
        [P("0.60 - 0.84", tdb), P("Definitely worth a closer look.", td),
         P("Include in the next audit sample. Review documents carefully.", td)],
        [P("0.30 - 0.59", tdb), P("Mildly unusual, but could be fine.", td),
         P("Note it down. Check if there is a reasonable explanation.", td)],
        [P("Below 0.30", tdb), P("Barely registers. Probably normal.", td),
         P("No special action needed. Routine monitoring.", td)],
    ]
    st = Table(sev_data, colWidths=[90, 200, 238])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(st)
    story.append(Spacer(1, 8))

    story.append(P("How District and MP Rankings Work", heading))
    story.append(P(
        "After all 12 project-level checks run, the system creates a single combined score for each "
        "district (Check 13) and each MP (Check 14). It works like a school report card - it looks at "
        "how many problems were found, what kind of problems, and how serious they were.",
        body
    ))

    rank_data = [
        [P("Tier", th), P("Who Falls Here", th), P("What It Tells You", th)],
        [P("Critical (Top 10%)", tdb), P("The worst 10% of districts or MPs.", td),
         P("These need immediate, focused audit attention. Something is likely off.", td)],
        [P("High Risk (Next 20%)", tdb), P("The 10th to 30th percentile.", td),
         P("Should be on the priority list. Not an emergency, but don't ignore them.", td)],
        [P("Medium (Next 30%)", tdb), P("The 30th to 60th percentile.", td),
         P("Average level of issues. Monitor normally, investigate if patterns grow.", td)],
        [P("Clean (Bottom 40%)", tdb), P("The best-performing 40%.", td),
         P("Looking good. Continue routine oversight.", td)],
    ]
    rt = Table(rank_data, colWidths=[110, 175, 243])
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(rt)
    story.append(Spacer(1, 8))

    story.append(P("A Few Things to Keep in Mind", heading))
    story.append(P("- <b>Flags are not accusations.</b> They are like a metal detector at an airport. It beeps, you check, and most of the time it is just a belt buckle.", body))
    story.append(P("- <b>Multiple flags matter more than one.</b> A project flagged by 3 or 4 different checks is much more worth investigating than one flagged by just 1.", body))
    story.append(P("- <b>Context matters.</b> A Rs. 5 Lakh project in a remote hill district will genuinely cost more than the same project in a city. The system accounts for this, but auditors should use their own judgment too.", body))
    story.append(P("- <b>The system learns from real data.</b> District averages, MP portfolios, and national baselines are all calculated from actual project records - not guesswork.", body))
    story.append(Spacer(1, 6))

    # ======================== ALGORITHMS TABLE ========================
    story.append(P("Algorithms & Techniques Used Across All 15 Detectors", heading))

    algo_data = [
        [P("Detector", th), P("Algorithm / Technique", th), P("What It Does (In Simple Words)", th)],
        [P("D-01", tdb), P("Isolation Forest", tdb),
         P("A machine learning algorithm that randomly slices data into smaller pieces. Points that get isolated very quickly (with fewer slices) are the unusual ones.", td)],
        [P("D-02", tdb), P("Sentence Transformers (AI Embeddings) + TF-IDF + Union-Find", tdb),
         P("AI converts text descriptions into numbers so the computer can measure how similar two sentences are. Union-Find then groups matching pairs into clusters.", td)],
        [P("D-02", tdb), P("Cosine Similarity", tdb),
         P("Measures the angle between two text vectors. If the angle is tiny (similarity close to 1.0), the texts mean nearly the same thing.", td)],
        [P("D-03", tdb), P("CPWD DSR Rate Benchmarking + Compound Inflation Model", tdb),
         P("Compares actual costs against official government rate tables, adjusted year-by-year using compound interest math for inflation.", td)],
        [P("D-03, D-11, D-15", tdb), P("Regex-Based NLP Quantity Extraction", tdb),
         P("Pattern-matching rules that read project descriptions and pull out numbers like '200 metres' or '3 units' from plain text.", td)],
        [P("D-04, D-12", tdb), P("Disbursement Ratio Analysis + Multi-Signal Compounding", tdb),
         P("Compares money paid vs. money claimed. When multiple warning signals overlap on the same project, their combined score goes up.", td)],
        [P("D-05", tdb), P("Threshold Band Clustering", tdb),
         P("Groups contracts that fall suspiciously close to regulatory price limits, then checks if they cluster in the same month by the same person.", td)],
        [P("D-06", tdb), P("Monotonic Severity Interpolation", tdb),
         P("A smooth mathematical curve that maps delay days to severity scores - the longer the delay, the higher the score, in a predictable way.", td)],
        [P("D-07", tdb), P("Weighted Fiscal Concentration Index + Velocity Ratio Analysis", tdb),
         P("Calculates what percentage of an MP's work and spending lands in March, and measures how much faster projects get completed near elections.", td)],
        [P("D-08", tdb), P("Statistical Process Control (Mean + 3-Sigma Spike Detection)", tdb),
         P("Calculates the normal daily completion rate for a district, then flags any day where completions jump beyond 3 standard deviations above normal.", td)],
        [P("D-09", tdb), P("Benford's Law (Chi-Square Goodness-of-Fit Test) + Bonferroni Correction", tdb),
         P("Tests whether the first digits of cost numbers follow a natural mathematical pattern. Bonferroni correction prevents false alarms when testing many MPs at once.", td)],
        [P("D-10", tdb), P("5-Dimensional NLP Specificity Scoring + Template Frequency Analysis", tdb),
         P("Scores each project description on 5 dimensions (measurements, location, specs, action, beneficiary) and catches copy-pasted boilerplate text.", td)],
        [P("D-13, D-14", tdb), P("Empirical Bayes Shrinkage + Percentile Ranking", tdb),
         P("A statistical technique that pulls small-sample scores toward the national average to prevent a district or MP with only a few projects from getting an unfair extreme score.", td)],
        [P("D-15", tdb), P("Cross-Category Cost Clustering + Unit Rate Rounding Analysis", tdb),
         P("Groups projects by exact cost or rounded unit rate and flags when too many unrelated projects share identical pricing.", td)],
    ]
    at = Table(algo_data, colWidths=[60, 165, 303])
    at.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white]),
    ]))
    story.append(at)
    story.append(Spacer(1, 6))

    story.append(P(
        "<i>This guide was written to help anyone - from a district collector to a concerned citizen - "
        "understand what the SATARK system checks and why. If something here is unclear, "
        "that is our fault, not yours. Ask and we will explain it better.</i>",
        note
    ))

    doc.build(story, canvasmaker=FooterCanvas)
    print(f"Done: {out_path}")


if __name__ == "__main__":
    go("/Users/suvendu/Downloads/SATARK_MPLADS_15_Detectors_Guide.pdf")
    go("/Users/suvendu/Downloads/SIH-DATA/SATARK_MPLADS_15_Detectors_Guide.pdf")
