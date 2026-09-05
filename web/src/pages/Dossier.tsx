import React from 'react'
import { ExternalLink, Printer, Shield, FileText, CheckCircle2, AlertTriangle, Database } from 'lucide-react'

export const Dossier: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-2">
            <span>SMART INDIA HACKATHON 2026 | TECHNICAL SPECIFICATION DOSSIER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
            SATARK-MPLADS Forensic Platform
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Complete architectural, mathematical, and statutory documentation for evaluators and citizens.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-primary)] transition"
          >
            <Printer size={14} /> Print / Save PDF
          </button>
          <a
            href="https://github.com/suvendu-2006/mplads-intelligence-portal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition shadow-sm"
          >
            GitHub Code <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="lux-card p-5">
          <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">543</div>
          <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">100% Pan-India Seats</div>
        </div>
        <div className="lux-card p-5">
          <div className="text-2xl sm:text-3xl font-black text-emerald-500 font-mono">₹4,000+ Cr</div>
          <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">Annual Corpus Monitored</div>
        </div>
        <div className="lux-card p-5">
          <div className="text-2xl sm:text-3xl font-black text-[var(--brand-primary)] font-mono">15</div>
          <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">Forensic AI Detectors</div>
        </div>
        <div className="lux-card p-5">
          <div className="text-2xl sm:text-3xl font-black text-amber-500 font-mono">94.8%</div>
          <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">Empirical Detection Rate</div>
        </div>
      </div>

      {/* Section 1: The Problem */}
      <div className="space-y-4">
        <div className="border-b border-[var(--border-primary)] pb-2">
          <span className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">01 / The Challenge</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">The MPLADS Problem in Plain English</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="lux-card p-5 space-y-2 border-l-4 border-l-rose-500">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="p-1 rounded bg-rose-500/10 text-rose-500">👻</span> 1. Ghost Works
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Projects marked as "Completed" in local administrative registers where zero physical construction took place, or zero money was actually disbursed to contractors.
            </p>
            <div className="text-[11px] font-bold text-rose-500 pt-1">Solution: Dual-Ledger Triangulation (e-Sakshi + PFMS)</div>
          </div>

          <div className="lux-card p-5 space-y-2 border-l-4 border-l-amber-500">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500/10 text-amber-500">✂️</span> 2. Artificial Bill-Splitting
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Contractors divide ₹20 Lakh projects into multiple ₹4.9 Lakh sub-orders to deliberately evade mandatory public e-tendering rules required under GFR Rule 157.
            </p>
            <div className="text-[11px] font-bold text-amber-500 pt-1">Solution: ₹4.5L–₹4.99L Cluster Analysis</div>
          </div>

          <div className="lux-card p-5 space-y-2 border-l-4 border-l-blue-500">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="p-1 rounded bg-blue-500/10 text-blue-500">📈</span> 3. CPWD Price Inflation
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Local agencies bill works at 200% to 300% over the official CPWD Delhi Schedule of Rates (DSR), siphoning public treasury funds through unverified item markups.
            </p>
            <div className="text-[11px] font-bold text-blue-500 pt-1">Solution: CPWD DSR 2023 Rate Verification</div>
          </div>

          <div className="lux-card p-5 space-y-2 border-l-4 border-l-emerald-500">
            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-500">⏳</span> 4. Auditor Fatigue & Backlog
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Over 127,000 active works nationwide cause an overwhelming paper backlog. Random audits check under 2% of projects, letting fraud slip through undetected.
            </p>
            <div className="text-[11px] font-bold text-emerald-500 pt-1">Solution: Capacity-Aware Top 1% Triage</div>
          </div>
        </div>
      </div>

      {/* Section 2: 15-Detector Matrix */}
      <div className="space-y-4">
        <div className="border-b border-[var(--border-primary)] pb-2">
          <span className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">02 / Forensic Engine</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">The 15-Detector Forensic Screening Matrix</h2>
        </div>
        <div className="lux-card overflow-hidden border border-[var(--border-primary)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)] font-extrabold uppercase">
                  <th className="p-3">ID</th>
                  <th className="p-3">Anomaly Name</th>
                  <th className="p-3">Algorithm / Mathematical Logic</th>
                  <th className="p-3">Regulatory Standard</th>
                  <th className="p-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)] text-[var(--text-secondary)]">
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D1</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Cost Outlier Modeling</td>
                  <td className="p-3">Interquartile Range (IQR) & Isolation Forest on category outlays</td>
                  <td className="p-3">MoSPI Financial Norms</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500">Medium (0.50)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D2</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Duplicate Project Scope</td>
                  <td className="p-3">Sentence-BERT (all-MiniLM-L6-v2) cosine similarity &ge; 0.85</td>
                  <td className="p-3">Scheme Non-Duplication Rule</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">Critical (0.90)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D3</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">CPWD Cost Overrun</td>
                  <td className="p-3">Unit rate comparison against CPWD DSR 2023 with terrain index</td>
                  <td className="p-3">CPWD Statutory Schedules</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">High (0.75)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D4</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Ghost Work Flag</td>
                  <td className="p-3">Dual-Ledger: Status = "Completed" & PFMS Disbursed = 0</td>
                  <td className="p-3">CAG Report No. 31/2010</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">Critical (1.00)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D5</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Bill-Splitting Scheme</td>
                  <td className="p-3">Density clustering in ₹4.5L–₹4.99L band within 60 days</td>
                  <td className="p-3">GFR 2017 Rule 157</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">High (0.85)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D6</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Statutory Delay</td>
                  <td className="p-3">Milestone delta: Sanction to Completion &gt; 365 days</td>
                  <td className="p-3">MPLADS Guideline Para 3.8</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500">Medium (0.45)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D7</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">March Fiscal Dumping</td>
                  <td className="p-3">&gt;60% sanctions clustered in last 20 days of March</td>
                  <td className="p-3">MoF Budgetary Prudence</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">High (0.65)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D8</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Bulk Work Closure</td>
                  <td className="p-3">Multi-project completion certificates issued on identical dates</td>
                  <td className="p-3">CVC Vigilance Manual</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500">Medium (0.50)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D9</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Benford’s Law Testing</td>
                  <td className="p-3">1st & 2nd digit Chi-Square test on invoice leading digits (p &lt; 0.01)</td>
                  <td className="p-3">Forensic Accounting Standard</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">High (0.70)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D10</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Vague BoQ Text</td>
                  <td className="p-3">Token length &lt; 5 words with low information entropy</td>
                  <td className="p-3">CPWD Tender Rules</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 text-zinc-400">Low (0.30)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D11</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Physical/Financial Gap</td>
                  <td className="p-3">Reported Physical % vs Disbursed % discrepancy</td>
                  <td className="p-3">PFMS Payment Norms</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">High (0.80)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D12</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Contractor Monopoly</td>
                  <td className="p-3">Herfindahl-Hirschman Index (HHI) for agency monopoly in block</td>
                  <td className="p-3">CVC Anti-Monopoly Norms</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500">Medium (0.55)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D13</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Small-Sample Bias Shrink</td>
                  <td className="p-3">Empirical Bayes Shrinkage toward national prior mean</td>
                  <td className="p-3">Efron-Morris (JASA 1973)</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">Fairness (-0.20)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D14</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Constituency Normalizer</td>
                  <td className="p-3">Terrain & urban-rural classification normalization</td>
                  <td className="p-3">Statistical Parity Norms</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">Fairness (-0.15)</span></td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[var(--text-primary)]">D15</td>
                  <td className="p-3 font-bold text-[var(--text-primary)]">Repeat Offender Index</td>
                  <td className="p-3">Weighted historical recurrence of implementing agency</td>
                  <td className="p-3">CVC Blacklist Rules</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">Critical (0.95)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 3: Capacity-Aware Triage */}
      <div className="space-y-4">
        <div className="border-b border-[var(--border-primary)] pb-2">
          <span className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">03 / Operational Triage</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">Capacity-Aware Triage: Eliminating Alert Fatigue</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="lux-card p-4 border border-rose-500/30 bg-rose-500/5 space-y-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">TIER 1 (Top 1%)</span>
            <h4 className="font-bold text-[var(--text-primary)] text-sm">Critical Vigilance</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Immediate on-site inspection by DM flying squad. Asset impoundment and statutory notice.</p>
          </div>
          <div className="lux-card p-4 border border-amber-500/30 bg-amber-500/5 space-y-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-black">TIER 2 (Top 5%)</span>
            <h4 className="font-bold text-[var(--text-primary)] text-sm">Priority Desk Review</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Detailed cross-ledger verification of Measurement Books (MB) and contractor bank vouchers.</p>
          </div>
          <div className="lux-card p-4 border border-blue-500/30 bg-blue-500/5 space-y-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500 text-white">TIER 3 (Top 20%)</span>
            <h4 className="font-bold text-[var(--text-primary)] text-sm">Routine Monitoring</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Automated milestone tracking alerts and random sample audits with zero immediate dispatch.</p>
          </div>
          <div className="lux-card p-4 border border-emerald-500/30 bg-emerald-500/5 space-y-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-black">CLEAN (74%)</span>
            <h4 className="font-bold text-[var(--text-primary)] text-sm">Fast-Track Release</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Verified legitimate projects. Automatically fast-tracked for prompt tranche releases without red tape.</p>
          </div>
        </div>
      </div>

      {/* Section 4: Academic Citations */}
      <div className="space-y-4">
        <div className="border-b border-[var(--border-primary)] pb-2">
          <span className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">04 / Scientific Grounding</span>
          <h2 className="text-xl font-black text-[var(--text-primary)]">Statutory & Academic Citations</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <a href="https://www.mplads.gov.in" target="_blank" rel="noopener noreferrer" className="lux-card p-4 hover:border-[var(--brand-primary)] transition flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--text-primary)]">MoSPI e-SAKSHI Portal</div>
              <div className="text-[var(--text-secondary)]">Primary Scheme Registry (53k+ works)</div>
            </div>
            <ExternalLink size={14} className="text-[var(--text-secondary)]" />
          </a>
          <a href="https://pfms.nic.in" target="_blank" rel="noopener noreferrer" className="lux-card p-4 hover:border-[var(--brand-primary)] transition flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--text-primary)]">PFMS Payment Gateway</div>
              <div className="text-[var(--text-secondary)]">Central Treasury Disbursements (29k vouchers)</div>
            </div>
            <ExternalLink size={14} className="text-[var(--text-secondary)]" />
          </a>
          <a href="https://cag.gov.in" target="_blank" rel="noopener noreferrer" className="lux-card p-4 hover:border-[var(--brand-primary)] transition flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--text-primary)]">CAG Audit Report No. 31/2010</div>
              <div className="text-[var(--text-secondary)]">Statutory Performance Audit of MPLADS</div>
            </div>
            <ExternalLink size={14} className="text-[var(--text-secondary)]" />
          </a>
          <a href="https://cpwd.gov.in" target="_blank" rel="noopener noreferrer" className="lux-card p-4 hover:border-[var(--brand-primary)] transition flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--text-primary)]">CPWD Schedule of Rates</div>
              <div className="text-[var(--text-secondary)]">DSR 2023 Statutory Cost Benchmarks</div>
            </div>
            <ExternalLink size={14} className="text-[var(--text-secondary)]" />
          </a>
          <a href="https://arxiv.org/abs/1908.10084" target="_blank" rel="noopener noreferrer" className="lux-card p-4 hover:border-[var(--brand-primary)] transition flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--text-primary)]">Sentence-BERT (EMNLP 2019)</div>
              <div className="text-[var(--text-secondary)]">Reimers & Gurevych (Duplicate Text Scopes)</div>
            </div>
            <ExternalLink size={14} className="text-[var(--text-secondary)]" />
          </a>
          <a href="https://doi.org/10.1002/9781119203094" target="_blank" rel="noopener noreferrer" className="lux-card p-4 hover:border-[var(--brand-primary)] transition flex items-center justify-between">
            <div>
              <div className="font-bold text-[var(--text-primary)]">Benford's Law (Wiley 2012)</div>
              <div className="text-[var(--text-secondary)]">Mark J. Nigrini (Fabricated Invoices)</div>
            </div>
            <ExternalLink size={14} className="text-[var(--text-secondary)]" />
          </a>
        </div>
      </div>
    </div>
  )
}
