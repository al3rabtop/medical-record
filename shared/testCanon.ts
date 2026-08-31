/**
 * Different labs write the same test differently — Arabic vs English,
 * abbreviated vs spelled out, "Total Cholesterol" vs "الكوليسترول الكلي".
 * This resolves any of those to one stable canonical code, so the same
 * test always lands on the same card instead of fragmenting.
 *
 * Deliberately kept SEPARATE where labs report different units for the
 * "same" test (e.g. creatinine in mg/dL vs µmol/L) — merging those would
 * silently corrupt the trend chart with a fake jump. See creatinine_umol_l.
 */

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "") // strip Arabic diacritics
    .replace(/[^0-9a-zA-Z\u0600-\u06FF]+/g, ""); // strip spaces/punctuation for loose matching

/** Canonical code -> every known alias (Arabic labels, English names, abbreviations). */
const ALIAS_GROUPS: Record<string, string[]> = {
  hemoglobin: ["الهيموغلوبين", "الهيموجلوبين", "هيموغلوبين", "هيموجلوبين", "hemoglobin", "haemoglobin", "hb"],
  hematocrit: ["الهيماتوكريت", "هيماتوكريت", "hematocrit", "haematocrit", "hct", "pcv"],
  rbc: ["كريات الدم الحمراء", "الكريات الحمراء", "خلايا الدم الحمراء", "عدد كريات الدم الحمراء", "rbc", "redbloodcells", "erythrocytes"],
  wbc: ["كريات الدم البيضاء", "الكريات البيضاء", "خلايا الدم البيضاء", "عدد خلايا الدم البيضاء", "wbc", "whitebloodcells", "leukocytes"],
  platelets: ["الصفائح الدموية", "صفائح", "platelets", "plt"],
  mcv: ["متوسط حجم الكرية", "متوسط حجم الخلية", "متوسط حجم خلايا الدم الحمراء", "متوسط حجم كريات الدم", "mcv", "meancorpuscularvolume"],
  mch: ["متوسط هيموغلوبين الكرية", "متوسط محتوى الهيموجلوبين", "متوسط الهيموجلوبين في الكرية", "متوسط وزن الهيموجلوبين", "متوسط كتلة الهيموجلوبين", "متوسط محتوى الهيموجلوبين في الكرية", "mch", "meancorpuscularhemoglobin"],
  mchc: ["تركيز هيموغلوبين الكرية", "تركيز الهيموجلوبين الخلوي المتوسط", "متوسط تركيز الهيموجلوبين", "تركيز الهيموجلوبين في الكرية", "تركيز الهيموجلوبين المتوسط في الكرية", "mchc"],
  rdw: ["تباين حجم الكريات", "توزيع حجم الكريات", "توزيع عرض الكرية الحمراء", "توزيع عرض خلايا الدم الحمراء", "توزيع عرض خلايا الدم", "rdw"],
  neutrophils: ["العدلات", "النيتروفيل", "الخلايا المتعادلة", "المتعادلات", "الخلايا المتعددة النوى", "neutrophils", "neut"],
  lymphocytes: ["الخلايا اللمفاوية", "اللمفاويات", "الليمفوسيت", "الليمفوسيتات", "الليمفوسيت النسبة", "الليمفوسيت العدد", "الليمفوسيتات العدد المطلق", "لمفاويات", "lymphocytes", "lym"],
  monocytes: ["الوحيدات", "الأحادية", "الخلايا الأحادية", "الخلايا الأحادية العدد المطلق", "الخلايا أحادية النوى", "monocytes", "mono"],
  eosinophils: ["الحمضات", "الخلايا الحمضية", "eosinophils", "eos"],
  basophils: ["الأسسات", "الخلايا القاعدية", "القاعديات", "basophils", "baso"],

  ferritin: ["الفيريتين", "فيريتين", "ferritin"],
  iron: ["الحديد", "حديد المصل", "serumiron", "iron", "fe"],

  total_cholesterol: ["الكوليسترول الكلي", "كوليسترول كلي", "totalcholesterol", "cholesterol"],
  ldl: ["الكوليسترول الضار", "كوليسترول البروتين الدهني منخفض الكثافة", "ldl", "ldlcholesterol"],
  hdl: ["الكوليسترول النافع", "كوليسترول البروتين الدهني عالي الكثافة", "hdl", "hdlcholesterol"],
  cholesterol_hdl_ratio: ["نسبة الكوليسترول لـ hdl", "نسبة الكوليسترول الى hdl", "نسبة الكوليسترول إلى hdl", "نسبة الكوليسترول للـhdl", "cholesterolhdlratio", "tcholhdlratio"],
  triglycerides: ["الدهون الثلاثية", "triglycerides", "tg"],

  hba1c: ["السكر التراكمي", "الهيموجلوبين السكري", "hba1c", "a1c", "glycatedhemoglobin"],
  glucose: ["سكر الدم الصائم", "الجلوكوز", "glucose", "fbg", "fastingglucose"],

  tsh: ["الهرمون المنبه للغدة الدرقية", "الهرمون المنبه للدرقية", "الهرمون المنشط للغدة الدرقية", "هرمون تحفيز الغدة الدرقية", "tsh", "thyroidstimulatinghormone", "thyrotropin"],
  total_t3: ["t3 الكلي", "totalt3", "t3"],
  total_t4: ["t4 الكلي", "totalt4", "t4"],
  free_t4: ["ft4", "freet4"],

  vitamin_d: ["فيتامين د", "فيتامين d", "vitamind", "25ohvitamind", "vitamind25oh"],
  vitamin_b12: ["فيتامين ب12", "فيتامين b12", "vitaminb12", "b12", "cobalamin"],
  calcium: ["الكالسيوم", "calcium", "ca"],

  creatinine: ["الكرياتينين", "creatinine", "cr"],
  // Kept separate from `creatinine` on purpose — different unit, see file header.
  creatinine_umol_l: [],
  urea: ["اليوريا", "urea", "bun"],
  egfr: ["egfr", "estimatedgfr"],
  uric_acid: ["حمض اليوريك", "uricacid"],

  alt: ["إنزيم alt", "ألانين أمينوترانسفيراز", "إنزيم ناقل أمين الألانين", "alt", "sgpt", "alanineaminotransferase"],
  alt_u_l: [],
  ast: ["إنزيم ast", "أسبارتات أمينوترانسفيراز", "إنزيم ناقل أمين الأسبارتات", "ast", "sgot", "aspartateaminotransferase"],
  alp: ["الفوسفاتاز القلوية", "الفسفاتاز القلوي", "alkalinephosphatase", "alp"],
  bilirubin_total: ["البيليروبين الكلي", "totalbilirubin"],
  bilirubin_total_umol_l: [],
  bilirubin_direct: ["البيليروبين المباشر", "directbilirubin"],
  ggt: ["جاما جلوتاميل ترانسفيراز", "gammagt", "ggt", "gammaglutamyltransferase"],
  albumin: ["الألبومين", "albumin", "albuminserum"],
  albumin_globulin_ratio: ["نسبة الألبومين للجلوبيولين", "نسبة الالبومين للجلوبيولين", "نسبة الألبومين إلى الجلوبيولين", "نسبة الألبومين إلى الغلوبيولين", "albuminglobulinratio", "agratio"],
  globulin: ["الغلوبولين", "الجلوبيولين", "الغلوبيولين", "globulin"],
  total_protein: ["البروتين الكلي", "totalprotein"],

  inr: ["inr", "internationalnormalizedratio"],
  pt: ["زمن البروثرومبين", "prothrombintime", "pt"],
  aptt: ["aptt", "activatedpartialthromboplastintime"],

  sodium: ["الصوديوم", "sodium", "na"],
  potassium: ["البوتاسيوم", "potassium", "k"],
  magnesium: ["الماغنيسيوم", "المغنيسيوم", "magnesium", "mg"],
  cpk: ["كرياتين فوسفوكاينيز", "cpk", "creatinephosphokinase"],

  urine_wbc: ["كريات الدم البيضاء في البول", "الكريات البيضاء في البول", "خلايا الدم البيضاء في البول", "uwbc", "urinewbc"],
  urine_rbc: ["كريات الدم الحمراء في البول", "الكريات الحمراء في البول", "خلايا الدم الحمراء في البول", "urbc", "urinerbc"],
  urine_protein: ["بروتين البول", "البروتين في البول", "urineprotein"],
  urine_glucose: ["جلوكوز البول", "الجلوكوز في البول", "urineglucose"],
  urine_ph: ["الحموضة", "urineph", "ph"],
  urine_specific_gravity: ["الكثافة النوعية", "specificgravity", "spgravity"],

  cea: ["cea", "carcinoembryonicantigen"],
};

const ALIAS_TO_CODE = new Map<string, string>();
for (const [code, aliases] of Object.entries(ALIAS_GROUPS)) {
  ALIAS_TO_CODE.set(norm(code), code);
  for (const alias of aliases) ALIAS_TO_CODE.set(norm(alias), code);
}

// Sorted longest-first so substring matching prefers the more specific alias
// (e.g. "creatinine in serum" should match "creatinine", not a shorter
// unrelated alias that happens to be a substring).
const ALIASES_BY_LENGTH = Array.from(ALIAS_TO_CODE.entries()).sort((a, b) => b[0].length - a[0].length);

/** Pulls embedded Latin tokens like "INR" or "SGPT" out of a mixed-script label. */
function latinTokens(s: string): string[] {
  return s.match(/[A-Za-z][A-Za-z0-9/]{1,}/g) ?? [];
}

export type TestCodeResolution = {
  code: string;
  /** True when this matched a known alias; false when it's a generated fallback slug. */
  matched: boolean;
};

/**
 * Resolves a test to its canonical code. Tries, in order: the English
 * abbreviation field, embedded Latin tokens inside the label (many lab
 * exports write "الاسم العربي ENGLISH_ABBR" as one string), an exact label
 * match, then substring containment. Falls back to a slug of the label so
 * unrecognised tests still get a stable code — but callers that care about
 * not overwriting a perfectly good existing code should check `matched`.
 */
export function resolveTestCodeDetailed(label: string, abbr?: string | null): TestCodeResolution {
  if (abbr) {
    const core = abbr.replace(/\([^)]*\)/g, " ").trim();
    const paren = abbr.match(/\(([^)]+)\)/)?.[1] ?? "";
    for (const candidate of [core, paren, abbr]) {
      const hit = ALIAS_TO_CODE.get(norm(candidate));
      if (hit) return { code: hit, matched: true };
    }
  }

  const normLabel = norm(label);

  const exact = ALIAS_TO_CODE.get(normLabel);
  if (exact) return { code: exact, matched: true };

  // Embedded English abbreviation, e.g. "النسبة المعيارية الدولية INR" -> INR.
  for (const token of latinTokens(label)) {
    const hit = ALIAS_TO_CODE.get(norm(token));
    if (hit) return { code: hit, matched: true };
  }

  // Substring containment both ways, longest alias first, with a floor so
  // short aliases (like "k" for potassium) can't false-match unrelated text.
  // Ratio-style tests (e.g. "نسبة الألبومين للجلوبيولين") are protected from
  // false substring merges by their own exact aliases above, matched before
  // this loop ever runs — so a plain differential-percentage label like
  // "النيتروفيل النسبة" is still free to merge with its base test.
  // Substring containment: does the label CONTAIN a known alias?
  // A general specimen guard runs first: if the label marks itself as a
  // urine specimen (e.g. "خلايا الدم الحمراء في البول"), it must never
  // fall through to a same-named BLOOD test's code via substring — that
  // would silently overwrite the blood result with the urine one. Only an
  // exact urine_* alias (checked above) or no match at all is safe here.
  const isUrineSpecimen = /في البول|بالبول|في الادرار|urine/.test(normLabel);

  // General cross-test-ratio guard: if the label says "نسبة" (ratio/percentage)
  // AND it substring-matches two or more DIFFERENT tests (e.g. "نسبة
  // الكرياتينين للألبومين" mentions both creatinine and albumin), that is a
  // distinct ratio test, not either ingredient alone — resolving it via
  // substring to either one would silently overwrite that test's real value.
  // A single-entity percentage like "النيتروفيل النسبة" only matches one
  // code and is unaffected.
  if (normLabel.includes(norm("نسبة"))) {
    const distinctHits = new Set<string>();
    for (const [aliasNorm, code] of ALIASES_BY_LENGTH) {
      if (aliasNorm.length < 4) continue;
      if (normLabel.includes(aliasNorm)) distinctHits.add(code);
    }
    if (distinctHits.size > 1) {
      return { code: fallbackSlug(label), matched: false };
    }
  }

  for (const [aliasNorm, code] of ALIASES_BY_LENGTH) {
    if (aliasNorm.length < 4) continue;
    if (isUrineSpecimen && !code.startsWith("urine_")) continue;
    if (normLabel.includes(aliasNorm)) {
      return { code, matched: true };
    }
  }

  return { code: fallbackSlug(label), matched: false };
}

function fallbackSlug(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^0-9a-zA-Z\u0600-\u06FF]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "result"
  );
}

/** Convenience wrapper for callers that only need the code. */
export function resolveTestCode(label: string, abbr?: string | null): string {
  return resolveTestCodeDetailed(label, abbr).code;
}
