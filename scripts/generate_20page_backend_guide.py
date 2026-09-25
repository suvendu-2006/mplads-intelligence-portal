import os
import sys
import re
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that computes total pages dynamically
    and paints headers/footers with 'Page X of 20'.
    """
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
            self.draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_header_footer(self, page_count):
        # We skip header/footer on page 1 (Cover Page)
        if self._pageNumber > 1:
            self.saveState()
            
            # Running Header
            self.setFont("Helvetica-Bold", 7.5)
            self.setFillColor(colors.HexColor("#1E3A8A"))
            self.drawString(45, 804, "MPLADS NATIONAL INTELLIGENCE & FORENSIC SURVEILLANCE PLATFORM")
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(550, 804, "SYSTEM BACKEND ARCHITECTURE MANUAL")
            
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.6)
            self.line(45, 798, 550, 798)
            
            # Running Footer
            self.line(45, 38, 550, 38)
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(45, 27, "Confidential — Ministry of Statistics & Programme Implementation (MoSPI) System Architecture")
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(550, 27, page_text)
            
            self.restoreState()

def create_callout(title: str, text: str, icon: str = "💡", bg="#F8FAFC", border="#CBD5E1", title_color="#1E3A8A"):
    styles = getSampleStyleSheet()
    t_style = ParagraphStyle(
        'CalloutTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor(title_color),
        spaceAfter=2
    )
    b_style = ParagraphStyle(
        'CalloutBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.0,
        leading=11,
        textColor=colors.HexColor("#334155")
    )
    content = [
        Paragraph(f"{icon} <b>{title}</b>", t_style),
        Paragraph(text, b_style)
    ]
    t = Table([[content]], colWidths=[505])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg)),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor(border)),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t

def create_table(header_data, rows_data, col_widths=None):
    styles = getSampleStyleSheet()
    h_style = ParagraphStyle(
        'THeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=0
    )
    c_style = ParagraphStyle(
        'TCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#1E293B")
    )
    c_bold = ParagraphStyle(
        'TCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#0F172A")
    )

    formatted_header = [Paragraph(c, h_style) for c in header_data]
    table_data = [formatted_header]
    for r in rows_data:
        row_cells = []
        for i, val in enumerate(r):
            if i == 0:
                row_cells.append(Paragraph(str(val), c_bold))
            else:
                row_cells.append(Paragraph(str(val), c_style))
        table_data.append(row_cells)

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t

print("Base helper structures configured.")
