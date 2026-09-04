import { useStore, LangMode } from '../store/useStore'

export const dictionary: Record<string, Record<LangMode, string>> = {
  // Navigation (8)
  'nav.overview': { en: 'Overview', hi: 'अवलोकन' },
  'nav.browse_states': { en: 'Browse States & UTs', hi: 'राज्य व केंद्रशासित प्रदेश' },
  'nav.browse_mps': { en: 'MPs Performance', hi: 'सांसद प्रदर्शन' },
  'nav.gis_map': { en: 'GIS Map', hi: 'भू-नक्शा' },
  'nav.my_state': { en: 'My State', hi: 'मेरा राज्य' },
  'nav.district_dash': { en: 'District Authority', hi: 'जिला प्राधिकरण' },
  'nav.mp_dash': { en: 'MP Constituency', hi: 'सांसद क्षेत्र' },
  'nav.audit_desk': { en: 'Audit Desk', hi: 'लेखा-परीक्षा केंद्र' },
  'nav.login': { en: 'Official Login', hi: 'अधिकारिक लॉगिन' },
  'nav.search_placeholder': { en: 'Search MP, State, District, Work ID...', hi: 'सांसद, राज्य, जिला, कार्य आईडी खोजें...' },
  'nav.public_section': { en: 'PUBLIC PORTAL', hi: 'सार्वजनिक पोर्टल' },
  'nav.role_section': { en: 'OFFICIAL COMMAND', hi: 'अधिकारिक कमांड' },

  // Roles (7)
  'role.viewer': { en: 'Public Viewer', hi: 'सार्वजनिक दर्शक' },
  'role.mp': { en: 'Member of Parliament (MP)', hi: 'संसद सदस्य (सांसद)' },
  'role.district': { en: 'District Authority (Collector)', hi: 'जिला प्राधिकरण (जिलाधिकारी)' },
  'role.analyst': { en: 'Data Analyst', hi: 'डेटा विश्लेषक' },
  'role.auditor': { en: 'Forensic Auditor', hi: 'फोरेंसिक लेखा-परीक्षक' },
  'role.state_nodal': { en: 'State Nodal Officer', hi: 'राज्य नोडल अधिकारी' },
  'role.admin': { en: 'Administrator', hi: 'प्रशासक' },

  // KPI Labels (9)
  'kpi.allocated': { en: 'Allocated Budget', hi: 'आवंटित बजट' },
  'kpi.used': { en: 'Used (Disbursed)', hi: 'व्यय (वितरित)' },
  'kpi.utilization': { en: 'Utilization Rate', hi: 'उपयोग दर' },
  'kpi.payment_gap': { en: 'Payment Gap', hi: 'भुगतान अंतर' },
  'kpi.total_mps': { en: 'Total MPs Monitored', hi: 'कुल सांसद' },
  'kpi.pending': { en: 'Works Pending Queue', hi: 'लंबित कार्य' },
  'kpi.completed': { en: 'Works Completed', hi: 'पूर्ण कार्य' },
  'kpi.ongoing': { en: 'Active Commitments', hi: 'सक्रिय देनदारियां' },
  'kpi.expenditure_rate': { en: 'Delivery Velocity', hi: 'वितरण गति' },

  // Buttons & Actions (10)
  'btn.browse_states': { en: 'Explore States & UTs →', hi: 'राज्य व केंद्रशासित प्रदेश देखें →' },
  'btn.browse_mps': { en: 'Explore MPs →', hi: 'सांसद देखें →' },
  'btn.export_csv': { en: 'Export CSV', hi: 'CSV निर्यात करें' },
  'btn.switch_role': { en: 'Switch Role', hi: 'भूमिका बदलें' },
  'btn.show_details': { en: 'Show Details →', hi: 'विवरण देखें →' },
  'btn.view_flags': { en: 'View Flags', hi: 'ध्वजांकन देखें' },
  'btn.dispatch_notice': { en: 'Dispatch Show-Cause Notice', hi: 'कारण बताओ नोटिस भेजें' },
  'btn.freeze_payment': { en: 'Freeze PFMS Disbursal', hi: 'PFMS भुगतान रोकें' },
  'btn.send_do_letter': { en: 'Draft MP D.O. Letter', hi: 'सांसद अर्द्ध-शासकीय पत्र' },
  'btn.close': { en: 'Close', hi: 'बंद करें' },
  'btn.filter': { en: 'Filter', hi: 'फ़िल्टर' },
  'btn.reset': { en: 'Reset', hi: 'रीसेट' },

  // Chart Titles & Labels (10)
  'chart.allocated': { en: 'Allocated', hi: 'आवंटित' },
  'chart.utilized': { en: 'Utilized', hi: 'व्यय' },
  'chart.completed': { en: 'Completed Works', hi: 'पूर्ण कार्य' },
  'chart.ongoing': { en: 'Ongoing Works', hi: 'चालू कार्य' },
  'chart.pending': { en: 'Pending Works', hi: 'लंबित कार्य' },
  'chart.sectoral': { en: 'Sectoral Distribution', hi: 'क्षेत्रवार व्यय' },
  'chart.top_states': { en: 'Allocated vs Utilized by Top States & UTs', hi: 'शीर्ष राज्य व केंद्रशासित प्रदेशों का आवंटन एवं उपयोग' },
  'chart.trend': { en: 'Multi-Year Treasury Trajectory', hi: 'बहु-वर्षीय निधि प्रक्षेपवक्र' },
  'chart.distribution': { en: 'Works Completion Status', hi: 'कार्य निष्पादन स्थिति' },
  'chart.ranking': { en: 'State & UT Performance League Table', hi: 'राज्य व केंद्रशासित प्रदेश निष्पादन तालिका' },

  // Tooltips & Descriptions (16)
  'tooltip.corpus': {
    en: 'Statutory corpus sanctioned for parliamentary constituency development over the 5-year tenure.',
    hi: '5-वर्षीय कार्यकाल में संसदीय क्षेत्र विकास हेतु स्वीकृत वैधानिक कोष।'
  },
  'tooltip.red_flag': {
    en: 'Works flagged by anomaly detection models for cost inflation, advance release, or ghost work patterns.',
    hi: 'लागत विसंगति, अग्रिम भुगतान या फर्जी कार्य पैटर्न हेतु एल्गोरिदम द्वारा ध्वजांकित कार्य।'
  },
  'tooltip.utilization': {
    en: 'Percentage of sanctioned funds disbursed and accounted for with valid Utilization Certificates (UCs).',
    hi: 'स्वीकृत निधि में से वितरित एवं उपयोग प्रमाण पत्र (यूसी) द्वारा सत्यापित राशि का प्रतिशत।'
  },
  'tooltip.payment_gap': {
    en: 'Difference between expenditure committed by district authority and liquid disbursal completed.',
    hi: 'जिला प्राधिकरण द्वारा स्वीकृत कार्य लागत एवं वास्तविक रूप से किए गए नकद भुगतान के बीच का अंतर।'
  },
  'tooltip.portfolio': {
    en: 'Cumulative value of all recommended and sanctioned civil infrastructure works.',
    hi: 'सभी अनुशंसित एवं स्वीकृत नागरिक अवसंरचना कार्यों का संचयी मूल्य।'
  },
  'tooltip.cpwd_benchmark': {
    en: 'Central Public Works Department (DSR 2023) fair market item schedule rate with 25% statutory tolerance.',
    hi: 'केंद्रीय लोक निर्माण विभाग (DSR 2023) उचित बाजार मूल्य दर 25% वैधानिक सहिष्णुता सीमा के साथ।'
  },

  // Hero Section
  'hero.title': {
    en: "MPLADS — Your MP's Fund, Tracked in Public",
    hi: 'MPLADS — आपके सांसद का कोष, सार्वजनिक रूप से ट्रैक'
  },
  'hero.subtitle': {
    en: '₹{total} Crores sanctioned nationally. ₹{used} Crores ({percent}%) has reached the ground.',
    hi: '₹{total} करोड़ राष्ट्रीय स्तर पर स्वीकृत। ₹{used} करोड़ ({percent}%) जमीन तक पहुँच चुका है।'
  },
  'hero.source': {
    en: 'Live Telemetry & Ground Realization Data · Ministry of Statistics & Programme Implementation',
    hi: 'प्रत्यक्ष डेटा एवं जमीनी प्रगति · सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय (MoSPI)'
  },

  // Tabs (8)
  'tab.overview': { en: 'Overview', hi: 'अवलोकन' },
  'tab.districts': { en: 'Districts', hi: 'जिले' },
  'tab.works': { en: 'Civil Works', hi: 'नागरिक कार्य' },
  'tab.flags': { en: 'Forensic Flags', hi: 'फोरेंसिक ध्वजांकन' },
  'tab.agencies': { en: 'Implementing Agencies', hi: 'कार्यान्वयन एजेंसियां' },
  'tab.dossier': { en: 'Declarations & Dossier', hi: 'घोषणापत्र एवं डोजियर' },
  'tab.risk': { en: 'Algorithmic Risk', hi: 'एल्गोरिदम जोखिम' },
  'tab.analytics': { en: 'Analytics', hi: 'विश्लेषण' },

  // Table Headers (10)
  'th.work_id': { en: 'Work ID', hi: 'कार्य आईडी' },
  'th.description': { en: 'Description', hi: 'विवरण' },
  'th.cost': { en: 'Cost (INR)', hi: 'लागत (रुपये)' },
  'th.status': { en: 'Status', hi: 'स्थिति' },
  'th.district': { en: 'District', hi: 'जिला' },
  'th.state': { en: 'State', hi: 'राज्य' },
  'th.mp': { en: 'Member of Parliament', hi: 'संसद सदस्य' },
  'th.detector': { en: 'Detector', hi: 'डिटेक्टर' },
  'th.severity': { en: 'Severity', hi: 'गंभीरता' },
  'th.actions': { en: 'Actions', hi: 'कार्रवाई' },

  // Filters & Tiers (10)
  'filter.all_states': { en: 'All States', hi: 'सभी राज्य' },
  'filter.all_tiers': { en: 'All Tiers', hi: 'सभी स्तर' },
  'filter.all_detectors': { en: 'All Detectors', hi: 'सभी डिटेक्टर' },
  'filter.tier_red': { en: 'Red (High Risk)', hi: 'लाल (उच्च जोखिम)' },
  'filter.tier_amber': { en: 'Amber (Moderate)', hi: 'पीला (मध्यम जोखिम)' },
  'filter.tier_green': { en: 'Green (Compliant)', hi: 'हरा (अनुकूल)' },
  'filter.sort_by': { en: 'Sort by', hi: 'क्रमबद्ध करें' },
  'filter.clear': { en: 'Clear Filters', hi: 'फ़िल्टर हटाएं' },
  'filter.search': { en: 'Search...', hi: 'खोजें...' },
  'filter.export': { en: 'Export Report', hi: 'रिपोर्ट निर्यात करें' },

  // Breadcrumbs & Badges (8)
  'bc.home': { en: 'Home', hi: 'होम' },
  'bc.states': { en: 'States', hi: 'राज्य' },
  'bc.mps': { en: 'MPs', hi: 'सांसद' },
  'bc.audit': { en: 'Audit Desk', hi: 'लेखा-परीक्षा' },
  'badge.estimated': { en: 'Estimated', hi: 'अनुमानित' },
  'badge.verified': { en: 'Verified', hi: 'सत्यापित' },
  'badge.synced': { en: 'Synced', hi: 'समन्वयित' },
  'badge.official': { en: 'Official Record', hi: 'अधिकारिक रिकॉर्ड' },

  // Common Messages (6)
  'msg.no_records': { en: 'No records found matching your query.', hi: 'आपके अनुरोध से मेल खाता कोई रिकॉर्ड नहीं मिला।' },
  'msg.loading': { en: 'Fetching verified treasury telemetry...', hi: 'सत्यापित राजकोषीय डेटा लोड हो रहा है...' },
  'msg.error': { en: 'An error occurred while loading data.', hi: 'डेटा लोड करते समय त्रुटि उत्पन्न हुई।' },
  'msg.showing_top': { en: 'Showing top records', hi: 'शीर्ष रिकॉर्ड दिखाए जा रहे हैं' },
  'msg.risk_unavailable': { en: 'Risk telemetry unavailable for this entity.', hi: 'इस इकाई के लिए जोखिम डेटा उपलब्ध नहीं है।' },
  'msg.est_disclaimer': { en: 'Values marked (Est.) use statutory average cost formula.', hi: '(अनुमानित) चिह्नित मूल्य वैधानिक औसत लागत सूत्र पर आधारित हैं।' }
}

export function t(key: string, vars?: Record<string, string>): string {
  const lang = useStore.getState().lang
  let text = dictionary[key]?.[lang] || dictionary[key]?.['en'] || key

  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    })
  }

  return text
}
