import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  Shield,
  Building2,
  Users,
  Lock,
  Landmark
} from 'lucide-react'

const PERSONAS = [
  {
    role: 'viewer',
    title: 'Public Citizen',
    hindiTitle: 'सार्वजनिक नागरिक',
    icon: Users,
    badge: 'Open Transparency',
    description: 'Explore national fiscal realizations, browse state and MP ledgers, and view GIS boundaries.',
    route: '/',
    defaultContext: {}
  },
  {
    role: 'mp',
    title: 'Member of Parliament (MP)',
    hindiTitle: 'संसद सदस्य (सांसद)',
    icon: Landmark,
    badge: 'Constituency Command',
    description: 'Track your ₹5 Cr/year (avg ₹15.09 Cr/MP actual) entitlement corpus, verify recommended works delivery, and issue D.O. letters.',
    route: '/mp-dashboard',
    defaultContext: {
      mpId: '6a932b5bcd944524379eddd9',
      mpName: 'Anurag Singh Thakur',
      state: 'Himachal Pradesh'
    }
  },
  {
    role: 'district_authority',
    title: 'District Authority (Collector)',
    hindiTitle: 'जिला प्राधिकरण (जिलाधिकारी)',
    icon: Building2,
    badge: 'Collectorate Sanctions',
    description: 'Supervise district works sanction queue, verify Measurement Books (MB), and inspect IDA agencies.',
    route: '/district-dashboard',
    defaultContext: {
      district: 'SHIMLA',
      state: 'HIMACHAL PRADESH'
    }
  },
  {
    role: 'state_nodal_officer',
    title: 'State Nodal Authority (SNA)',
    hindiTitle: 'राज्य नोडल अधिकारी',
    icon: Shield,
    badge: 'State Surveillance',
    description: 'Monitor cross-district liability, track Single Nodal Account (SNA) releases, and issue Show-Cause notices.',
    route: '/my-state',
    defaultContext: {
      state: 'HIMACHAL PRADESH'
    }
  },
  {
    role: 'mospi',
    title: 'MoSPI Central Authority',
    hindiTitle: 'सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय (MoSPI)',
    icon: Shield,
    badge: 'Apex Executive Oversight',
    description: 'Omnipotent system authority: screen national works, freeze treasury holds, certify civil projects, and take action on everything.',
    route: '/audit',
    defaultContext: {
      state: 'ALL',
      district: 'ALL'
    }
  }
]

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const { switchRole } = useStore()
  const [selectedPersona, setSelectedPersona] = useState<string>('viewer')
  const [username, setUsername] = useState('officer.mospi@gov.in')
  const [password, setPassword] = useState('••••••••••••')
  const [loading, setLoading] = useState(false)

  const handlePersonaLogin = async (persona: typeof PERSONAS[0]) => {
    setLoading(true)
    try {
      await switchRole(
        persona.role,
        persona.defaultContext.state,
        persona.defaultContext.district,
        persona.defaultContext.mpId,
        persona.defaultContext.mpName
      )
      navigate(persona.route)
    } finally {
      setLoading(false)
    }
  }

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const persona = PERSONAS.find((p) => p.role === selectedPersona) || PERSONAS[0]
    await handlePersonaLogin(persona)
  }

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-6 px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl space-y-8">
        {/* Portal Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 text-xs font-bold uppercase tracking-wider">
            <span>सत्यमेव जयते &bull; Sovereign Fiscal Surveillance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
            SATARK-MPLADS Multi-Profile Command Gate
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl mx-auto">
            Authorized portal for Members of Parliament, State Nodal Secretaries, District Collectors, and Indian Citizens.
          </p>
        </div>

        {/* 1-Click Persona Grid */}
        <div className="space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-2">
            <span>SELECT ACCESS PERSONA (ONE-CLICK SOVEREIGN DEMO LOGIN)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PERSONAS.map((persona) => {
              const Icon = persona.icon
              const isSelected = selectedPersona === persona.role

              return (
                <div
                  key={persona.role}
                  onClick={() => setSelectedPersona(persona.role)}
                  className={`lux-card p-5 cursor-pointer flex flex-col justify-between transition-all relative ${
                    isSelected
                      ? 'border-[var(--brand-primary)] shadow-md ring-2 ring-[var(--brand-primary)]/20'
                      : 'hover:border-[var(--brand-accent)]'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-[var(--brand-primary)] text-white text-[9px] font-extrabold uppercase tracking-wider shadow">
                      Selected
                    </div>
                  )}

                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-primary)] mb-3">
                      <Icon size={20} />
                    </div>

                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] block mb-1">
                      {persona.badge}
                    </span>

                    <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                      {persona.title}
                    </h3>
                    <span className="text-[10px] text-[var(--text-tertiary)] block mb-2 font-medium">
                      {persona.hindiTitle}
                    </span>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                      {persona.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePersonaLogin(persona)
                    }}
                    disabled={loading}
                    className="mt-4 w-full py-2 px-3 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--brand-primary)] hover:text-white text-[var(--brand-primary)] text-xs font-bold flex items-center justify-center gap-1.5 transition border border-[var(--border-primary)] shadow-sm"
                  >
                    <span>Sign In →</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Credentials Form (Alternative / Production Appearance) */}
        <div className="lux-card max-w-md mx-auto p-6 space-y-4">
          <div className="text-center pb-2 border-b border-[var(--border-primary)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Direct Authentication Credentials
            </h3>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              Signed-in as: <strong className="text-[var(--brand-primary)]">{selectedPersona.toUpperCase()}</strong>
            </span>
          </div>

          <form onSubmit={handleCredentialSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[var(--text-secondary)] mb-1">
                Official MoSPI / NIC ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--text-secondary)] mb-1">
                Password / Digital Signature Key
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--brand-primary)] text-white font-bold text-xs shadow hover:opacity-90 transition flex items-center justify-center gap-2 mt-2"
            >
              <Lock size={14} />
              <span>{loading ? 'Authenticating...' : 'Enter Sovereign Dashboard'}</span>
            </button>
          </form>

          <p className="text-[10px] text-center text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-primary)]">
            🔒 Protected under the Public Financial Management System (PFMS) & National Informatics Centre (NIC) security framework.
          </p>
        </div>
      </div>
    </div>
  )
}
