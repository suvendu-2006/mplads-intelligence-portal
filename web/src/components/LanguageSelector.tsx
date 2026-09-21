import React, { useState, useRef, useEffect } from 'react'
import { Languages, Search, X, Check } from 'lucide-react'
import { useTranslation, SUPPORTED_LANGUAGES, LanguageInfo, triggerPageTranslation } from '../lib/i18n'
import { LangMode } from '../store/useStore'

export const LanguageSelector: React.FC = () => {
  const { lang, setLang } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('satark_lang') as LangMode | null
      if (saved && saved !== 'en') {
        const timer = setTimeout(() => {
          triggerPageTranslation(saved)
        }, 800)
        return () => clearTimeout(timer)
      }
    } catch {}
  }, [])

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0]

  const filteredLanguages = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return SUPPORTED_LANGUAGES
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    )
  }, [search])

  const handleSelect = (code: LangMode) => {
    setLang(code)
    try {
      localStorage.setItem('satark_lang', code)
    } catch {}
    triggerPageTranslation(code)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Language"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-primary)] text-xs font-bold text-[var(--text-primary)] transition cursor-pointer shadow-2xs"
        title="Change Portal Language (All 22 Official Indian Languages)"
      >
        <Languages size={14} className="text-[var(--brand-primary)]" />
        <span className="hidden sm:inline font-semibold text-xs tracking-tight">{currentLang.nativeName}</span>
        <span className="sm:hidden font-semibold text-xs uppercase">{currentLang.code}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header & Search */}
          <div className="p-2.5 border-b border-[var(--border-primary)] bg-[var(--surface-alt)]/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Languages size={14} className="text-[var(--brand-primary)]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
                  Select Language / भाषा चुनें
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                23 Languages
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search language or state..."
                className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)]"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Language List */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {filteredLanguages.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--text-tertiary)]">
                No matching language found
              </div>
            ) : (
              filteredLanguages.map((l: LanguageInfo) => {
                const isSelected = l.code === lang
                return (
                  <button
                    key={l.code}
                    onClick={() => handleSelect(l.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer group ${
                      isSelected
                        ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                        : 'hover:bg-[var(--surface-alt)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                          {l.nativeName}
                        </span>
                        <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                          ({l.name})
                        </span>
                      </div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`}>
                        {l.region}
                      </div>
                    </div>

                    {isSelected && <Check size={14} className="text-white shrink-0 ml-2" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-[10px] text-[var(--text-tertiary)] flex items-center justify-between">
            <span>Official 8th Schedule Languages</span>
            <span>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  )
}
