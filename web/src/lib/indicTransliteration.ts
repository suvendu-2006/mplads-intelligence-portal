/**
 * SATARK-MPLADS Indic Transliteration & Entity Translation Engine
 * Translates and transliterates Indian Parliamentary Constituencies, Districts, and MP Names
 * into all 22 scheduled Indian languages (Odia, Hindi, Bengali, Telugu, Tamil, Marathi, Gujarati, etc.)
 */

import { LangMode } from '../store/useStore'

// Target Unicode script base offsets
const SCRIPT_BASES: Record<string, number> = {
  hi: 0x0900, mr: 0x0900, sa: 0x0900, mai: 0x0900, ne: 0x0900, kok: 0x0900, doi: 0x0900, brx: 0x0900,
  bn: 0x0980, as: 0x0980, mni: 0x0980,
  pa: 0x0A00,
  gu: 0x0A80,
  or: 0x0B00,
  ta: 0x0B80,
  te: 0x0C00,
  kn: 0x0C80,
  ml: 0x0D00,
}

// Common Indian words, titles & suffixes dictionary
const COMMON_TERMS: Record<string, Partial<Record<LangMode, string>>> = {
  'singh': { hi: 'सिंह', or: 'ସିଂହ', bn: 'সিংহ', te: 'సింగ్', ta: 'சிங்', mr: 'सिंह', gu: 'સિંહ', kn: 'ಸಿಂಗ್', ml: 'സിംഗ്', pa: 'ਸਿੰਘ' },
  'kumar': { hi: 'कुमार', or: 'କୁମାର', bn: 'কুমার', te: 'కుమార్', ta: 'குமார்', mr: 'कुमार', gu: 'કુમાર', kn: 'ಕುಮಾರ್', ml: 'കുമാർ', pa: 'ਕੁਮਾਰ' },
  'prasad': { hi: 'प्रसाद', or: 'ପ୍ରସାଦ', bn: 'প্রসাদ', te: 'ప్రసాద్', ta: 'பிரசாத்', mr: 'प्रसाद', gu: 'પ્રસાદ', kn: 'ಪ್ರಸಾದ್', ml: 'പ്രസാദ്', pa: 'ਪ੍ਰਸਾਦ' },
  'sharma': { hi: 'शर्मा', or: 'ଶର୍ମା', bn: 'শর্মা', te: 'శర్మ', ta: 'சர்மா', mr: 'शर्मा', gu: 'શર્મા', kn: 'ಶರ್ಮಾ', ml: 'ശർമ്മ', pa: 'ਸ਼ਰਮਾ' },
  'verma': { hi: 'वर्मा', or: 'ବର୍ମା', bn: 'বর্মা', te: 'వర్మ', ta: 'வர்மா', mr: 'वर्मा', gu: 'વર્મા', kn: 'ವರ್ಮಾ', ml: 'വർമ്മ', pa: 'ਵਰਮਾ' },
  'yadav': { hi: 'यादव', or: 'ଯାଦବ', bn: 'যাদব', te: 'యాదవ్', ta: 'யாதவ்', mr: 'यादव', gu: 'યાદવ', kn: 'ಯಾದವ್', ml: 'യാദവ്', pa: 'ਯਾਦਵ' },
  'patel': { hi: 'पटेल', or: 'ପଟେଲ', bn: 'পটেল', te: 'పటేల్', ta: 'படேல்', mr: 'पटेल', gu: 'પટેલ', kn: 'ಪಟೇಲ್', ml: 'പട്ടേൽ', pa: 'ਪਟੇਲ' },
  'reddy': { hi: 'रेड्डी', or: 'ରେଡ୍ଡୀ', bn: 'রেড্ডি', te: 'రెడ్డి', ta: 'ரெட்டி', mr: 'रेड्डी', gu: 'રેડ્ડી', kn: 'ರೆಡ್ಡಿ', ml: 'റെഡ്ഡി', pa: 'ਰੇਡੀ' },
  'rao': { hi: 'राव', or: 'ରାଓ', bn: 'রাও', te: 'రావు', ta: 'ராவ்', mr: 'राव', gu: 'રાવ', kn: 'ರಾವ್', ml: 'റാവു', pa: 'ਰਾਓ' },
  'gandhi': { hi: 'गांधी', or: 'ଗାନ୍ଧୀ', bn: 'গান্ধী', te: 'గాంధీ', ta: 'காந்தி', mr: 'गांधी', gu: 'ગાંધી', kn: 'ಗಾಂಧಿ', ml: 'ഗാന്ധി', pa: 'ਗਾਂਧੀ' },
  'patnaik': { hi: 'पटनायक', or: 'ପଟ୍ଟନାୟକ', bn: 'পট্টনায়ক', te: 'పట్నాయక్', ta: 'பட்நாயக்', mr: 'पटनायक', gu: 'પટનાયક', kn: 'ಪಟ್ನಾಯಕ್', ml: 'പട്നായിക്', pa: 'ਪਟਨਾਇਕ' },
  'pradhan': { hi: 'प्रधान', or: 'ପ୍ରଧାନ', bn: 'প্রধান', te: 'ప్రధాన్', ta: 'பிரதான்', mr: 'प्रधान', gu: 'પ્રધાન', kn: 'ಪ್ರಧಾನ್', ml: 'പ്രധാൻ', pa: 'ਪ੍ਰਧਾਨ' },
  'das': { hi: 'दास', or: 'ଦାସ', bn: 'দাস', te: 'దాస్', ta: 'தாஸ்', mr: 'दास', gu: 'દાસ', kn: 'ದಾಸ್', ml: 'ദാസ്', pa: 'ਦਾਸ' },
  'mishra': { hi: 'मिश्रा', or: 'ମିଶ୍ର', bn: 'মিশ্র', te: 'మిశ్రా', ta: 'மிஸ்ரா', mr: 'मिश्रा', gu: 'મિશ્રા', kn: 'ಮಿಶ್ರಾ', ml: 'മിശ്ര', pa: 'ਮਿਸ਼ਰਾ' },
  'tripathy': { hi: 'त्रिपाठी', or: 'ତ୍ରିପାଠୀ', bn: 'ত্রিপাঠী', te: 'త్రిపాఠి', ta: 'திரிபாதி', mr: 'त्रिपाठी', gu: 'ત્રિપાઠી', kn: 'ತ್ರಿಪಾಠಿ', ml: 'ത്രിപാഠി', pa: 'ਤ੍ਰਿਪਾਠੀ' },
  'tripathi': { hi: 'त्रिपाठी', or: 'ତ୍ରିପାଠୀ', bn: 'ত্রিপাঠী', te: 'త్రిపాఠి', ta: 'திரிபாதி', mr: 'त्रिपाठी', gu: 'ત્રિપાઠી', kn: 'ತ್ರಿಪಾಠಿ', ml: 'ത്രിപാഠി', pa: 'ਤ੍ਰਿਪਾਠੀ' },
  'mohanty': { hi: 'महांती', or: 'ମହାନ୍ତି', bn: 'মহান্তি', te: 'మొహంతి', ta: 'மொஹந்தி', mr: 'महांती', gu: 'મોહંતી', kn: 'ಮೊಹಂತಿ', ml: 'മൊഹന്തി', pa: 'ਮੋਹੰਤੀ' },
  'jena': { hi: 'जेना', or: 'ଜେନା', bn: 'জেনা', te: 'జెనా', ta: 'ஜேனா', mr: 'जेना', gu: 'જેના', kn: 'ಜೆನಾ', ml: 'ജെന', pa: 'ਜੇਨਾ' },
  'behera': { hi: 'बेहेरा', or: 'ବେହେରା', bn: 'বেহেরা', te: 'బెహెరా', ta: 'பெஹெரா', mr: 'बेहेरा', gu: 'બેહેરા', kn: 'ಬೆಹೆರಾ', ml: 'ബെഹെറ', pa: 'ਬେਹੇਰਾ' },
  'sahu': { hi: 'साहू', or: 'ସାହୁ', bn: 'সাহু', te: 'సాహు', ta: 'சாஹு', mr: 'साहू', gu: 'સાહુ', kn: 'ಸಾಹು', ml: 'സാഹു', pa: 'ସାହୂ' },
  'sahoo': { hi: 'साहू', or: 'ସାହୁ', bn: 'সাহু', te: 'సాహు', ta: 'சாஹு', mr: 'साहू', gu: 'સાહુ', kn: 'ಸಾಹು', ml: 'സാഹു', pa: 'ସାହୂ' },
  'rout': { hi: 'राउत', or: 'ରାଉତ', bn: 'রাউত', te: 'రౌత్', ta: 'ராவ்த்', mr: 'राउत', gu: 'રાઉત', kn: 'ರಾವತ್', ml: 'റാവുത്ത്', pa: 'ਰਾਉਤ' },
  'naik': { hi: 'नायक', or: 'ନାୟକ', bn: 'নায়ক', te: 'నాయక్', ta: 'நாயக்', mr: 'नायक', gu: 'નાયક', kn: 'ನಾಯಕ್', ml: 'നായക്', pa: 'ਨਾਇਕ' },
  'nayak': { hi: 'नायक', or: 'ନାୟକ', bn: 'নায়ক', te: 'నాయక్', ta: 'நாயக்', mr: 'नायक', gu: 'નાયક', kn: 'ನಾಯಕ್', ml: 'നായക്', pa: 'ਨਾਇਕ' },
  'swain': { hi: 'स्वांई', or: 'ସ୍ୱାଇଁ', bn: 'স্বাইঁ', te: 'స్వైన్', ta: 'ஸ்வைன்', mr: 'स्वांई', gu: 'સ્વાઈં', kn: 'ಸ್ವೈನ್', ml: 'സ്വയിൻ', pa: 'ਸਵਾਈਂ' },
  'mahapatra': { hi: 'महापात्र', or: 'ମହାପାତ୍ର', bn: 'মহাপাত্র', te: 'మహాపాత్ర', ta: 'மகாபாத்ரா', mr: 'महापात्र', gu: 'મહાપાત્ર', kn: 'ಮಹಾಪಾತ್ರ', ml: 'മഹാപാത്ര', pa: 'ਮਹਾਪਾਤਰਾ' },
  'chouhan': { hi: 'चौहान', or: 'ଚୌହାନ', bn: 'চৌহান', te: 'చౌహాన్', ta: 'சௌஹான்', mr: 'चौहान', gu: 'ચૌહાણ', kn: 'ಚೌಹಾಣ್', ml: 'ചൗഹാൻ', pa: 'ਚੌਹਾਨ' },
  'chauhan': { hi: 'चौहान', or: 'ଚୌହାନ', bn: 'চৌহান', te: 'చౌహాన్', ta: 'சௌஹான்', mr: 'चौहान', gu: 'ચૌહાણ', kn: 'ಚೌಹಾಣ್', ml: 'ചൗഹാൻ', pa: 'ਚੌਹਾਨ' },
  'modi': { hi: 'मोदी', or: 'ମୋଦୀ', bn: 'মোদী', te: 'మోదీ', ta: 'மோடி', mr: 'मोदी', gu: 'મોદી', kn: 'ಮೋದಿ', ml: 'മോദി', pa: 'ਮੋਦੀ' },
}

// Curated high-frequency Constituencies Dictionary
const CONSTITUENCY_DICT: Record<string, Partial<Record<LangMode, string>>> = {
  'vidisha': {
    hi: 'विदिशा', or: 'ବିଦିଶା', bn: 'বিদিশা', te: 'విదిశ', ta: 'விதிஷா', mr: 'विदिशा', gu: 'વિદિશા', kn: 'ವಿದಿಶಾ', ml: 'വിദിശ', pa: 'ਵਿਦਿਸ਼ਾ'
  },
  'varanasi': {
    hi: 'वाराणसी', or: 'ବାରାଣସୀ', bn: 'বারাণসী', te: 'వారణాసి', ta: 'வாரணாசி', mr: 'वाराणसी', gu: 'વારાણસી', kn: 'ವಾರಣಾಸಿ', ml: 'വാരാണസി', pa: 'ਵਾਰਾਣਸੀ'
  },
  'puri': {
    hi: 'पुरी', or: 'ପୁରୀ', bn: 'পুরী', te: 'పూరీ', ta: 'பூரி', mr: 'पुरी', gu: 'પુરી', kn: 'ಪುರಿ', ml: 'പുരി', pa: 'ਪੁਰੀ'
  },
  'bhubaneswar': {
    hi: 'भुवनेश्वर', or: 'ଭୁବନେଶ୍ୱର', bn: 'ভুবনেশ্বর', te: 'భువనేశ్వర్', ta: 'புவனேஸ்வர்', mr: 'भुवनेश्वर', gu: 'ભુવનેશ્વર', kn: 'ಭುವನೇಶ್ವರ', ml: 'ഭുവനേശ്വർ', pa: 'ਭੁਵਨੇਸ਼ਵਰ'
  },
  'cuttack': {
    hi: 'कटक', or: 'କଟକ', bn: 'কটক', te: 'కటక్', ta: 'கட்டாக்', mr: 'कटक', gu: 'કટક', kn: 'ಕಟಕ್', ml: 'കട്ടക്ക്', pa: 'ਕਟਕ'
  },
  'sambalpur': {
    hi: 'संबलपुर', or: 'ସମ୍ବଲପୁର', bn: 'সম্বলপুর', te: 'సంబల్పూర్', ta: 'சம்பல்பூர்', mr: 'संबलपूर', gu: 'સંબલપુર', kn: 'ಸಂಬಲ್ಪುರ', ml: 'സംബൽപൂർ', pa: 'ਸੰਬਲਪੁਰ'
  },
  'balasore': {
    hi: 'बालेश्वर', or: 'ବାଲେଶ୍ୱର', bn: 'বালেশ্বর', te: 'బాలాసోర్', ta: 'பாலாசோர்', mr: 'बालेश्वर', gu: 'બાલાસોર', kn: 'ಬಾಲಸೋರ್', ml: 'ബാലസോർ', pa: 'ਬਾਲਾਸੋਰ'
  },
  'berhampur': {
    hi: 'ब्रह्मपुर', or: 'ବ୍ରହ୍ମପୁର', bn: 'ব্রহ্মপুর', te: 'బెర్హంపూర్', ta: 'பெர்ஹாம்பூர்', mr: 'ब्रह्मपूर', gu: 'બરહમપુર', kn: 'ಬ್ರಹ್ಮಪುರ', ml: 'ബെർഹാംപുർ', pa: 'ਬਰਹਮਪੁਰ'
  },
  'bargarh': {
    hi: 'बरगढ़', or: 'ବରଗଡ଼', bn: 'বরগড়', te: 'బర్గఢ్', ta: 'பர்கர்', mr: 'बरगड', gu: 'બરગઢ', kn: 'ಬರಗಢ', ml: 'ബർഗഡ്', pa: 'ਬਰਗੜ੍ਹ'
  },
  'kalahandi': {
    hi: 'कालाहांडी', or: 'କଳାହାଣ୍ଡି', bn: 'কালাহান্ডি', te: 'కలహండి', ta: 'காலாஹான்டி', mr: 'कालाहांडी', gu: 'કાલાહાંડી', kn: 'ಕಲಹಂಡಿ', ml: 'കലഹണ്ടി', pa: 'ਕਾਲਾਹਾਂਡੀ'
  },
  'koraput': {
    hi: 'कोरापुट', or: 'କୋରାପୁଟ', bn: 'কোরাপুট', te: 'కోరాపుట్', ta: 'கோராபுட்', mr: 'कोरापुट', gu: 'કોરાપુટ', kn: 'ಕೊರಾಪುಟ್', ml: 'കൊരാപുട്', pa: 'ਕੋਰਾਪੁਟ'
  },
  'mayurbhanj': {
    hi: 'मयूरभंज', or: 'ମୟୂରଭଞ୍ଜ', bn: 'ময়ূরভঞ্জ', te: 'మయూర్‌భంజ్', ta: 'மயூர்பஞ்ச்', mr: 'मयूरभंज', gu: 'મયૂરભંજ', kn: 'ಮಯೂರಭಂಜ', ml: 'മയൂർഭഞ്ച്', pa: 'ਮਯੂਰਭੰਜ'
  },
  'sundargarh': {
    hi: 'सुंदरगढ़', or: 'ସୁନ୍ଦରଗଡ଼', bn: 'সুন্দরগড়', te: 'సుందర్‌గఢ్', ta: 'சுந்தர்கர்', mr: 'सुंदरगड', gu: 'સુંદરગઢ', kn: 'ಸುಂದರಗಢ', ml: 'സുന്ദർഗഡ്', pa: 'ਸੁੰਦਰਗੜ੍ਹ'
  },
  'kendrapara': {
    hi: 'केंद्रपाड़ा', or: 'କେନ୍ଦ୍ରାପଡ଼ା', bn: 'কেন্দ্রাপাড়া', te: 'కేంద్రపారా', ta: 'கேந்திரபாரா', mr: 'केंद्रपाडा', gu: 'કેન્દ્રપાડા', kn: 'ಕೇಂದ್ರಪಾರಾ', ml: 'കേന്ദ്രപാറ', pa: 'ਕੇਂਦਰਪਾੜਾ'
  },
  'jagatsinghpur': {
    hi: 'जगतसिंहपुर', or: 'ଜଗତସିଂହପୁର', bn: 'জগৎসিংহপুর', te: 'జగత్‌సింగ్‌పూర్', ta: 'ஜகத்சிங்பூர்', mr: 'जगतसिंगपूर', gu: 'જગતસિંહપુર', kn: 'ಜಗತ್ಸಿಂಗ್ಪುರ', ml: 'ജഗത്സിംഗ്പുർ', pa: 'ਜਗਤਸਿੰਘਪੁਰ'
  },
  'jajpur': {
    hi: 'जाजपुर', or: 'ଯାଜପୁର', bn: 'যাজপুর', te: 'జాజ్‌పూర్', ta: 'ஜாஜ்பூர்', mr: 'जाजपूर', gu: 'જાજપુર', kn: 'ಜಾಜ್ಪುರ', ml: 'ജാജ്പുർ', pa: 'ਜାଜਪੁਰ'
  },
  'dhenkanal': {
    hi: 'ढेंकानाल', or: 'ଢେଙ୍କାନାଳ', bn: 'ঢেঙ্কানাল', te: 'ధెంకనాల్', ta: 'தேன்கனல்', mr: 'धेंकानाल', gu: 'ઢેંકનાલ', kn: 'ಧೆಂಕನಾಲ್', ml: 'ധെങ്കനാൽ', pa: 'ਢੇਂਕਾਨਾਲ'
  },
  'bolangir': {
    hi: 'बलांगिर', or: 'ବଲାଙ୍ଗୀର', bn: 'বলাঙ্গির', te: 'బొలాంగీర్', ta: 'போலங்கிர்', mr: 'बलांगिर', gu: 'બલાંગીર', kn: 'ಬೊಲಾಂಗಿರ್', ml: 'ബൊലാംഗിർ', pa: 'ਬਲਾਂਗਿਰ'
  },
  'keonjhar': {
    hi: 'क्योंझर', or: 'କେନ୍ଦୁଝର', bn: 'কেউঁঝর', te: 'కియోంఝర్', ta: 'கியோஞ்சர்', mr: 'क्योंझर', gu: 'ક્યોંઝર', kn: 'ಕಿಯೋಂಜರ್', ml: 'കിയോഞ്ചർ', pa: 'ਕਿਓਂਝਰ'
  },
  'bhadrak': {
    hi: 'भद्रक', or: 'ଭଦ୍ରକ', bn: 'ভদ্রক', te: 'భద్రక్', ta: 'பத்ரக்', mr: 'भद्रक', gu: 'ભદ્રક', kn: 'ಭದ್ರಕ್', ml: 'ഭദ്രക്', pa: 'ਭਦਰਕ'
  },
  'nabarangpur': {
    hi: 'नबरंगपुर', or: 'ନବରଙ୍ଗପୁର', bn: 'নবরঙ্গপুর', te: 'నబరంగ్‌పూర్', ta: 'நபரங்பூர்', mr: 'नबरंगपूर', gu: 'નબરંગપુર', kn: 'ನಬರಂಗಪುರ', ml: 'നബരംഗ്പുർ', pa: 'ਨਬਰੰਗਪੁਰ'
  },
  'aska': {
    hi: 'आस्का', or: 'ଆସିକା', bn: 'আস্কা', te: 'ఆస్కా', ta: 'ஆஸ்கா', mr: 'आस्का', gu: 'આસ્કા', kn: 'ಆಸ್ಕಾ', ml: 'ആസ്ക', pa: 'ਆਸਕਾ'
  },
  'kandhamal': {
    hi: 'कंधमाल', or: 'କନ୍ଧମାଳ', bn: 'কান্ধামাল', te: 'కంధమాల్', ta: 'கந்தமால்', mr: 'कंधमाल', gu: 'કંધમાલ', kn: 'ಕಂಧಮಾಲ್', ml: 'കന്ധമാൽ', pa: 'ਕੰਧਮਾਲ'
  },
  'new delhi': {
    hi: 'नई दिल्ली', or: 'ନୂଆ ଦିଲ୍ଲୀ', bn: 'নতুন দিল্লি', te: 'న్యూఢిల్లీ', ta: 'புது தில்லி', mr: 'नवी दिल्ली', gu: 'નવી દિલ્હી', kn: 'ಹೊಸ ದೆಹಲಿ', ml: 'ന്യൂഡൽഹി', pa: 'ਨਵੀਂ ਦਿੱਲੀ'
  },
  'bhopal': {
    hi: 'भोपाल', or: 'ଭୋପାଲ', bn: 'ভোপাল', te: 'భోపాల్', ta: 'போபால்', mr: 'भोपाळ', gu: 'ભોપાલ', kn: 'ಭೋಪಾಲ್', ml: 'ഭോപ്പാൽ', pa: 'ਭੋਪਾਲ'
  },
  'indore': {
    hi: 'इंदौर', or: 'ଇନ୍ଦୋର', bn: 'ইন্দোর', te: 'ఇండోర్', ta: 'இந்தோர்', mr: 'इंदूर', gu: 'ઇન્દોર', kn: 'ಇಂದೋರ್', ml: 'ഇൻഡോർ', pa: 'ਇੰਦੌਰ'
  },
  'gwalior': {
    hi: 'ग्वालियर', or: 'ଗ୍ୱାଲିୟର', bn: 'গোয়ালিয়র', te: 'గ్వాలియర్', ta: 'குவாலியர்', mr: 'ग्वाल्हेर', gu: 'ગ્વાલિયર', kn: 'ಗ್ವಾಲಿಯರ್', ml: 'ഗ്വാളിയോർ', pa: 'ਗਵਾਲੀਅਰ'
  },
  'jabalpur': {
    hi: 'जबलपुर', or: 'ଜବଲପୁର', bn: 'জবলপুর', te: 'జబల్‌పూర్', ta: 'ஜபல்பூர்', mr: 'जबलपूर', gu: 'જબલપુર', kn: 'ಜಬಲ್ಪುರ', ml: 'ജബൽപൂർ', pa: 'ਜਬਲਪੁਰ'
  },
  'amethi': {
    hi: 'अमेठी', or: 'ଆମେଠି', bn: 'আমেঠি', te: 'అమేథీ', ta: 'அமேதி', mr: 'अमेठी', gu: 'અમેઠી', kn: 'ಅಮೇಥಿ', ml: 'അമേഠി', pa: 'ਅਮੇਠੀ'
  },
  'lucknow': {
    hi: 'लखनऊ', or: 'ଲକ୍ଷ୍ନୌ', bn: 'লখনউ', te: 'లక్నో', ta: 'லக்னோ', mr: 'लखनौ', gu: 'લખનૌ', kn: 'ಲಕ್ನೋ', ml: 'ലഖ്‌നൗ', pa: 'ਲਖਨਊ'
  },
  'patna sahib': {
    hi: 'पटना साहिब', or: 'ପାଟନା ସାହିବ', bn: 'পাটনা সাহিব', te: 'పాట్నా సాహిబ్', ta: 'பாட்னா சாஹிப்', mr: 'पाटणा साहिब', gu: 'પટના સાહિબ', kn: 'ಪಾಟ್ನಾ ಸಾಹಿಬ್', ml: 'പട്‌ന സാഹിബ്', pa: 'ਪਟਨਾ ਸਾਹਿਬ'
  },
  'gandhinagar': {
    hi: 'गांधीनगर', or: 'ଗାନ୍ଧୀନଗର', bn: 'গান্ধীনগর', te: 'గాంధీనగర్', ta: 'காந்திநகர்', mr: 'गांधीनगर', gu: 'ગાંધીનગર', kn: 'ಗಾಂಧಿನಗರ', ml: 'ഗാന്ധിനഗർ', pa: 'ਗਾਂਧੀਨਗਰ'
  },
  'wayanad': {
    hi: 'वायनाड', or: 'ୱାୟନାଡ଼', bn: 'ওয়েনাড়', te: 'వాయనాడ్', ta: 'வயநாடு', mr: 'वायनाड', gu: 'વાયનાડ', kn: 'ವಯನಾಡ್', ml: 'വയനാട്', pa: 'ਵਾਇਨਾਡ'
  },
  'chennai central': {
    hi: 'चेन्नई सेंट्रल', or: 'ଚେନ୍ନାଇ ସେଣ୍ଟ୍ରାଲ', bn: 'চেন্নাই সেন্ট্রাল', te: 'చెన్నై సెంట్రల్', ta: 'சென்னை மத்திய', mr: 'चेन्नई सेंट्रल', gu: 'ચેન્નઈ સેન્ટ્રલ', kn: 'ಚೆನ್ನೈ ಸೆಂಟ್ರಲ್', ml: 'ചെന്നൈ സെൻട്രൽ', pa: 'ਚੇਨਈ ਸੈਂਟਰਲ'
  },
  'bangalore south': {
    hi: 'बैंगलोर दक्षिण', or: 'ବେଙ୍ଗାଲୁରୁ ଦକ୍ଷିଣ', bn: 'ব্যাঙ্গালোর দক্ষিণ', te: 'బెంగళూరు సౌత్', ta: 'பெங்களூரு தெற்கு', mr: 'बंगळुरू दक्षिण', gu: 'બેંગલોર દક્ષિણ', kn: 'ಬೆಂಗಳೂರು ದಕ್ಷಿಣ', ml: 'ബാംഗ്ലൂർ സൗത്ത്', pa: 'ਬੰਗਲੌਰ ਦੱਖਣ'
  },
}

// Curated MP Names Dictionary
const MP_DICT: Record<string, Partial<Record<LangMode, string>>> = {
  'shivraj singh chouhan': {
    hi: 'शिवराज सिंह चौहान', or: 'ଶିବରାଜ ସିଂହ ଚୌହାନ', bn: 'শিবরাজ সিংহ চৌহান', te: 'శివరాజ్ సింగ్ చౌహాన్', ta: 'சிவராஜ் சிங் சௌஹான்', mr: 'शिवराज सिंह चौहान', gu: 'શિવરાજ સિંહ ચૌહાણ', kn: 'ಶಿವರಾಜ್ ಸಿಂಗ್ ಚೌಹಾಣ್', ml: 'ശിവരാജ് സിംഗ് ചൗഹാൻ', pa: 'ਸ਼ਿਵਰਾਜ ਸਿੰਘ ਚੌਹਾਨ'
  },
  'narendra modi': {
    hi: 'नरेंद्र मोदी', or: 'ନରେନ୍ଦ୍ର ମୋଦୀ', bn: 'নরেন্দ্র মোদী', te: 'నరేంద్ర మోదీ', ta: 'நரேந்திர மோடி', mr: 'नरेंद्र मोदी', gu: 'નરેન્દ્ર મોદી', kn: 'ನರೇಂದ್ರ ಮೋದಿ', ml: 'നരേന്ദ്ര മോദി', pa: 'ਨਰਿੰਦਰ ਮੋਦੀ'
  },
  'dharmendra pradhan': {
    hi: 'धर्मेंद्र प्रधान', or: 'ଧର୍ମେନ୍ଦ୍ର ପ୍ରଧାନ', bn: 'ধর্মেন্দ্র প্রধান', te: 'ధర్మేంద్ర ప్రధాన్', ta: 'தர்மேந்திர பிரதான்', mr: 'धर्मेंद्र प्रधान', gu: 'ધર્મેન્દ્ર પ્રધાન', kn: 'ಧರ್ಮೇಂದ್ರ ಪ್ರಧಾನ್', ml: 'ധർമ്മേന്ദ്ര പ്രധാൻ', pa: 'ਧਰਮੇਂਦਰ ਪ੍ਰਧਾਨ'
  },
  'bhartruhari mahtab': {
    hi: 'भर्तृहरि महताब', or: 'ଭର୍ତ୍ତୃହରି ମହତାବ', bn: 'ভর্তৃহরি মহতাব', te: 'భర్తృహరి మహతాబ్', ta: 'பர்த்ருஹரி மஹ்தாப்', mr: 'भर्तृहरि महताब', gu: 'ભર્તૃહરિ મહતાબ', kn: 'ಭರ್ತೃಹರಿ ಮಹತಾಬ್', ml: 'ഭർതൃഹരി മഹ്താബ്', pa: 'ਭਰਤਰੁਹਰੀ ਮਹਿਤਾਬ'
  },
  'ashwini vaishnaw': {
    hi: 'अश्विनी वैष्णव', or: 'ଅଶ୍ୱିନୀ ବୈଷ୍ଣବ', bn: 'অশ্বিনী বৈষ্ণব', te: 'అశ్విని వైష్ణవ్', ta: 'அஸ்வினி வைஷ்ணவ்', mr: 'अश्विनी वैष्णव', gu: 'અશ્વિની વૈષ્ણવ', kn: 'ಅಶ್ವಿನಿ ವೈಷ್ಣವ್', ml: 'അശ്വിനി വൈഷ്ണവ്', pa: 'ਅਸ਼ਵਿਨੀ ਵੈਸ਼ਨਵ'
  },
  'amit shah': {
    hi: 'अमित शाह', or: 'ଅମିତ ଶାହ', bn: 'অমিত শাহ', te: 'అమిత్ షా', ta: 'அமித் ஷா', mr: 'अमित शाह', gu: 'અમિત શાહ', kn: 'ಅಮಿತ್ ಶಾ', ml: 'അമിത് ഷാ', pa: 'ਅਮਿਤ ਸ਼ਾਹ'
  },
  'rahul gandhi': {
    hi: 'राहुल गांधी', or: 'ରାହୁଲ ଗାନ୍ଧୀ', bn: 'রাহুল গান্ধী', te: 'రాహుల్ గాంధీ', ta: 'ராகுல் காந்தி', mr: 'राहुल गांधी', gu: 'રાહુલ ગાંધી', kn: 'ರಾಹುಲ್ ಗಾಂಧಿ', ml: 'രാഹുൽ ഗാന്ധി', pa: 'ਰਾਹੁਲ ਗਾਂਧੀ'
  },
  'rajnath singh': {
    hi: 'राजनाथ सिंह', or: 'ରାଜନାଥ ସିଂହ', bn: 'রাজনাথ সিংহ', te: 'రాజ్‌నాథ్ సింగ్', ta: 'ராஜ்நாத் சிங்', mr: 'राजनाथ सिंह', gu: 'રાજનાથ સિંહ', kn: 'ರಾಜನಾಥ್ ಸಿಂಗ್', ml: 'രാജ്‌നാഥ് സിംഗ്', pa: 'ਰਾਜਨਾਥ ਸਿੰਘ'
  },
  'nitin gadkari': {
    hi: 'नितिन गडकरी', or: 'ନିତିନ ଗଡ଼କରୀ', bn: 'নীতিন গডকরি', te: 'నితిన్ గడ్కరీ', ta: 'நிதின் கட்கரி', mr: 'नितीन गडकरी', gu: 'નિતિન ગડકરી', kn: 'ನಿತಿನ್ ಗಡ್ಕರಿ', ml: 'നിതിൻ ഗഡ്കരി', pa: 'ਨਿਤਿਨ ਗਡਕਰੀ'
  },
  'jyotiraditya scindia': {
    hi: 'ज्योतिरादित्य सिंधिया', or: 'ଜ୍ୟୋତିରାଦିତ୍ୟ ସିନ୍ଧିଆ', bn: 'জ্যোতিরাদিত্য সিন্ধিয়া', te: 'జ్యోతిరాదిత్య సింధియా', ta: 'ஜோதிர்ஆதித்ய சிந்தியா', mr: 'ज्योतिरादित्य शिंदे', gu: 'જ્યોતિરાદિત્ય સિંધિયા', kn: 'ಜ್ಯೋತಿರಾದಿತ್ಯ ಸಿಂಧಿಯಾ', ml: 'ജ്യോതിരാദിത്യ സിന്ധ്യ', pa: 'ਜਯੋਤੀਰਾਦਿੱਤਿਆ ਸਿੰਧੀਆ'
  },
  'giriraj singh': {
    hi: 'गिरिराज सिंह', or: 'ଗିରିରାଜ ସିଂହ', bn: 'গিরিরাজ সিংহ', te: 'గిరిరాజ్ సింగ్', ta: 'கிரிGeneral சிங்', mr: 'गिरीराज सिंह', gu: 'ગિરિરાજ સિંહ', kn: 'ಗಿರಿರಾಜ್ ಸಿಂಗ್', ml: 'ഗിരിരാജ് സിംഗ്', pa: 'ਗਿਰੀਰਾਜ ਸਿੰਘ'
  },
  'piyush goyal': {
    hi: 'पीयूष गोयल', or: 'ପିୟୂଷ ଗୋୟଲ', bn: 'পীযূষ গোয়েল', te: 'పీయూష్ గోయల్', ta: 'பியூஷ் கோயல்', mr: 'पीयूष गोयल', gu: 'પીયૂષ ગોયલ', kn: 'ಪಿಯೂಷ್ ಗೋಯಲ್', ml: 'പിയൂഷ് ഗോയൽ', pa: 'ਪੀਯੂਸ਼ ਗੋਇਲ'
  },
}

// Algorithmic phonetic transliteration fallback
const CONSONANT_MAP: Record<string, string> = {
  'ksh': 'क्ष', 'chh': 'छ', 'kh': 'ख', 'gh': 'घ', 'ng': 'ङ',
  'ch': 'च', 'jh': 'झ', 'ny': 'ञ',
  'th': 'थ', 'dh': 'ध', 'sh': 'श', 'ph': 'फ', 'bh': 'भ',
  'tr': 'त्र', 'gy': 'ज्ञ',
  'k': 'क', 'g': 'ग', 'c': 'क', 'j': 'ज', 't': 'त', 'd': 'द',
  'n': 'न', 'p': 'प', 'f': 'फ', 'b': 'ब', 'm': 'म',
  'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
  's': 'स', 'h': 'ह', 'z': 'ज़', 'q': 'क़', 'x': 'क्स'
}

const VOWEL_INDEP: Record<string, string> = {
  'aa': 'आ', 'ee': 'ई', 'ii': 'ई', 'oo': 'ऊ', 'uu': 'ऊ', 'ai': 'ऐ', 'au': 'औ', 'ou': 'औ',
  'a': 'अ', 'i': 'इ', 'u': 'उ', 'e': 'ए', 'o': 'ओ'
}

const VOWEL_MATRA: Record<string, string> = {
  'aa': 'ा', 'ee': 'ी', 'ii': 'ी', 'oo': 'ू', 'uu': 'ू', 'ai': 'ै', 'au': 'ौ', 'ou': 'ौ',
  'i': 'ि', 'u': 'ु', 'e': 'े', 'o': 'ो'
}

function romanToDevanagari(text: string): string {
  if (!text) return ''
  return text.split(/(\s+|[-_,./()]+)/).map((word) => {
    if (/^(\s+|[-_,./()]+)$/.test(word)) return word
    const w = word.toLowerCase().trim()
    if (!w) return word

    // Check common terms dictionary first
    if (COMMON_TERMS[w]?.hi) {
      return COMMON_TERMS[w]!.hi!
    }

    let res = ''
    let i = 0
    let afterConsonant = false

    while (i < w.length) {
      const c3 = w.slice(i, i + 3)
      const c2 = w.slice(i, i + 2)
      const c1 = w.slice(i, i + 1)

      // Vowels
      let vKey: string | null = null
      if (VOWEL_MATRA[c2] || VOWEL_INDEP[c2]) vKey = c2
      else if (VOWEL_MATRA[c1] || VOWEL_INDEP[c1] || c1 === 'a') vKey = c1

      if (vKey) {
        if (afterConsonant) {
          if (vKey === 'a') {
            if (i === w.length - 1) {
              res += 'ा'
            }
          } else {
            res += VOWEL_MATRA[vKey] || ''
          }
        } else {
          res += VOWEL_INDEP[vKey] || ''
        }
        i += vKey.length
        afterConsonant = false
        continue
      }

      // Consonants
      let cKey: string | null = null
      if (CONSONANT_MAP[c3]) cKey = c3
      else if (CONSONANT_MAP[c2]) cKey = c2
      else if (CONSONANT_MAP[c1]) cKey = c1

      if (cKey) {
        if (afterConsonant) {
          res += '्'
        }
        res += CONSONANT_MAP[cKey]
        i += cKey.length
        afterConsonant = true
        continue
      }

      res += c1
      i++
      afterConsonant = false
    }
    return res
  }).join('')
}

function devanagariToIndic(str: string, lang: LangMode): string {
  const base = SCRIPT_BASES[lang]
  if (!base || base === 0x0900) return str

  let res = ''
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]

    // Odia specific script nuances
    if (lang === 'or') {
      if (ch === '\u0935') {
        res += '\u0B2C' // व -> ବ
        continue
      }
      if (ch === '\u095F') {
        res += '\u0B5F' // य़ -> ୟ
        continue
      }
    }

    // Bengali specific script nuances
    if (lang === 'bn' || lang === 'as' || lang === 'mni') {
      if (ch === '\u0935') {
        res += '\u09AC' // व -> ব
        continue
      }
    }

    const code = ch.charCodeAt(0)
    if (code >= 0x0901 && code <= 0x097F) {
      res += String.fromCharCode(base + (code - 0x0900))
    } else {
      res += ch
    }
  }
  return res
}

/**
 * Transliterate any English text into the selected Indian script
 */
export function transliterateIndic(text: string | undefined | null, lang: LangMode): string {
  if (!text || lang === 'en') return text || ''
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  // 1. Direct dictionary match
  if (CONSTITUENCY_DICT[lower]?.[lang]) {
    return CONSTITUENCY_DICT[lower]![lang]!
  }
  if (MP_DICT[lower]?.[lang]) {
    return MP_DICT[lower]![lang]!
  }

  // 2. Transliterate via phonetic engine
  const deva = romanToDevanagari(trimmed)
  return devanagariToIndic(deva, lang)
}

/**
 * Translate/Transliterate Parliamentary Constituency name
 */
export function translateConstituency(name: string | undefined | null, lang: LangMode): string {
  if (!name || lang === 'en') return name || ''
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()

  const match = CONSTITUENCY_DICT[lower]?.[lang]
  if (match) return match

  return transliterateIndic(trimmed, lang)
}

/**
 * Translate/Transliterate Member of Parliament name
 */
export function translateMP(name: string | undefined | null, lang: LangMode): string {
  if (!name || lang === 'en') return name || ''
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()

  const match = MP_DICT[lower]?.[lang]
  if (match) return match

  return transliterateIndic(trimmed, lang)
}

/**
 * Translate/Transliterate District name
 */
export function translateDistrict(name: string | undefined | null, lang: LangMode): string {
  if (!name || lang === 'en') return name || ''
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()

  const match = CONSTITUENCY_DICT[lower]?.[lang]
  if (match) return match

  return transliterateIndic(trimmed, lang)
}
