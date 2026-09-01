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

/**
 * Arabic labels vary in spelling between labs in ways that are purely
 * orthographic: hamza forms, ta-marbuta, and transliteration choices like
 * هيموجلوبين vs هيموغلوبين or كولسترول vs كوليسترول. Collapsing those here
 * means one alias entry covers every spelling, instead of the table needing
 * a line per variant (and silently mis-resolving the ones nobody listed).
 */
const VARIANT_REPLACEMENTS: Array<[RegExp, string]> = [
  // Transliteration variants (applied before punctuation is stripped).
  [/هيموجلوبين|هيموقلوبين/g, "هيموغلوبين"],
  [/جلوبيولين|جلوبولين|غلوبيولين/g, "غلوبولين"],
  [/كولسترول/g, "كوليسترول"],
  [/الببومين|البيومين/g, "البومين"],
  [/فيرتين|فيرين/g, "فيريتين"],
];

const norm = (s: string) => {
  let out = s
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "") // strip Arabic diacritics
    .replace(/\u0640/g, "") // strip tatweel
    // Standard Arabic orthographic normalisation.
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أإآٱ -> ا
    .replace(/\u0629/g, "\u0647") // ة -> ه
    .replace(/\u0649/g, "\u064A") // ى -> ي
    .replace(/\u0624/g, "\u0648") // ؤ -> و
    .replace(/\u0626/g, "\u064A"); // ئ -> ي

  for (const [pattern, replacement] of VARIANT_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }

  return out.replace(/[^0-9a-zA-Z\u0600-\u06FF]+/g, ""); // strip spaces/punctuation
};

/** Canonical code -> every known alias (Arabic labels, English names, abbreviations). */
const ALIAS_GROUPS: Record<string, string[]> = {
  hemoglobin: ["الهيموغلوبين", "الهيموجلوبين", "هيموغلوبين", "هيموجلوبين", "hemoglobin", "haemoglobin", "hb"],
  hematocrit: ["الهيماتوكريت", "هيماتوكريت", "hematocrit", "haematocrit", "hct", "pcv"],
  rbc: ["كريات الدم الحمراء", "الكريات الحمراء", "خلايا الدم الحمراء", "عدد كريات الدم الحمراء", "rbc", "redbloodcells", "erythrocytes"],
  wbc: ["كريات الدم البيضاء", "الكريات البيضاء", "خلايا الدم البيضاء", "عدد خلايا الدم البيضاء", "wbc", "whitebloodcells", "leukocytes"],
  platelets: ["الصفائح الدموية", "صفائح", "platelets", "plt"],
  mcv: ["متوسط حجم الكرية", "متوسط حجم الخلية", "متوسط حجم الكريات", "متوسط حجم خلايا الدم الحمراء", "متوسط حجم كريات الدم", "mcv", "meancorpuscularvolume"],
  mch: ["متوسط هيموغلوبين الكرية", "متوسط محتوى الهيموجلوبين", "متوسط الهيموجلوبين في الكرية", "متوسط وزن الهيموجلوبين", "متوسط كتلة الهيموجلوبين", "متوسط محتوى الهيموجلوبين في الكرية", "mch", "meancorpuscularhemoglobin"],
  mchc: ["تركيز هيموغلوبين الكرية", "تركيز الهيموجلوبين الخلوي المتوسط", "متوسط تركيز الهيموجلوبين", "تركيز الهيموجلوبين في الكرية", "تركيز الهيموجلوبين المتوسط في الكرية", "mchc"],
  rdw: ["تباين حجم الكريات", "توزيع حجم الكريات", "توزيع عرض الكرية الحمراء", "توزيع عرض خلايا الدم الحمراء", "توزيع عرض خلايا الدم", "توزيع عرض الخلايا", "rdw"],
  // Differential counts come in TWO distinct measurements per cell type: a
  // percentage of white cells, and an absolute count per litre. They are
  // clinically different numbers (e.g. 55% vs 3.2 x10^9/L) and must never
  // share a code — plotting them on one trend line would be meaningless.
  // Bare labels with no qualifier keep the base code.
  neutrophils: ["العدلات", "النيتروفيل", "الخلايا المتعادلة", "المتعادلات", "الخلايا المتعددة النوى", "الخلايا المحببة", "neutrophils", "neut"],
  neutrophils_percent: ["النيتروفيل النسبة", "العدلات النسبة المئوية", "العدلات النسبة", "نسبة العدلات", "neut%", "neutrophilspercent"],
  neutrophils_absolute: ["النيتروفيل العدد", "العدلات العدد المطلق", "العدلات العدد", "العدد المطلق للعدلات", "absoluteneutrophilcount", "anc"],

  lymphocytes: ["الخلايا اللمفاوية", "اللمفاويات", "الليمفوسيت", "الليمفوسيتات", "لمفاويات", "lymphocytes", "lym"],
  lymphocytes_percent: ["الليمفوسيت النسبة", "الليمفوسيتات النسبة المئوية", "الليمفوسيتات النسبة", "نسبة اللمفاويات", "lym%", "lymphocytespercent"],
  lymphocytes_absolute: ["الليمفوسيت العدد", "الليمفوسيتات العدد المطلق", "الليمفوسيتات العدد", "absolutelymphocytecount", "alc"],

  monocytes: ["الوحيدات", "الأحادية", "الخلايا الأحادية", "الخلايا أحادية النوى", "monocytes", "mono"],
  monocytes_percent: ["الأحادية النسبة", "الخلايا الأحادية النسبة المئوية", "نسبة الوحيدات", "mono%", "monocytespercent"],
  monocytes_absolute: ["الأحادية العدد", "الخلايا الأحادية العدد المطلق", "عدد الخلايا الأحادية المطلق", "absolutemonocytecount"],

  eosinophils: ["الحمضات", "الخلايا الحمضية", "eosinophils", "eos"],
  eosinophils_percent: ["الحمضات النسبة", "الحمضات النسبة المئوية", "نسبة الحمضات", "eos%", "eosinophilspercent"],
  eosinophils_absolute: ["الحمضات العدد", "الحمضات العدد المطلق", "عدد الخلايا الحمضية المطلق", "absoluteeosinophilcount"],

  basophils: ["الأسسات", "الخلايا القاعدية", "القاعديات", "الحمضيات القاعدية", "basophils", "baso"],
  basophils_percent: ["القاعديات النسبة", "الخلايا القاعدية النسبة المئوية", "نسبة القاعديات", "baso%", "basophilspercent"],
  basophils_absolute: ["القاعديات العدد", "الخلايا القاعدية العدد المطلق", "عدد الخلايا القاعدية المطلق", "absolutebasophilcount"],

  ferritin: ["الفيريتين", "فيريتين", "ferritin"],
  iron: ["الحديد", "حديد المصل", "serumiron", "iron", "fe"],

  total_cholesterol: ["الكوليسترول الكلي", "كوليسترول كلي", "totalcholesterol", "cholesterol"],
  ldl: ["الكوليسترول الضار", "كوليسترول البروتين الدهني منخفض الكثافة", "ldl", "ldlcholesterol"],
  hdl: ["الكوليسترول النافع", "الكوليسترول الجيد", "كوليسترول البروتين الدهني عالي الكثافة", "hdl", "hdlcholesterol"],
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
  /**
   * Set when the label and the abbreviation each resolve to a *different*
   * known test. Extraction can swap short abbreviations (ALT vs AST is the
   * classic case), so the fuller label wins — but the caller is told, because
   * a contradiction here means the stored `abbr` is probably wrong too.
   */
  conflict?: { fromLabel: string; fromAbbr: string };
};

/**
 * Resolves a test to its canonical code. The label is treated as the more
 * reliable signal than the abbreviation: it is longer and more redundant,
 * whereas a three-letter abbreviation is exactly the kind of token an
 * OCR/extraction step silently swaps. The abbreviation is only used when
 * the label alone doesn't resolve.
 */
export function resolveTestCodeDetailed(label: string, abbr?: string | null): TestCodeResolution {
  const fromLabel = resolveFromLabel(label);
  const fromAbbr = abbr ? resolveFromAbbr(abbr) : null;

  if (fromLabel && fromAbbr && fromLabel !== fromAbbr) {
    // Trust the label, but surface the disagreement.
    return { code: fromLabel, matched: true, conflict: { fromLabel, fromAbbr } };
  }

  if (fromLabel) return { code: fromLabel, matched: true };
  if (fromAbbr) return { code: fromAbbr, matched: true };

  return { code: fallbackSlug(label), matched: false };
}

/** Resolves using only the abbreviation field. */
function resolveFromAbbr(abbr: string): string | null {
  const core = abbr.replace(/\([^)]*\)/g, " ").trim();
  const paren = abbr.match(/\(([^)]+)\)/)?.[1] ?? "";
  for (const candidate of [core, paren, abbr]) {
    const hit = ALIAS_TO_CODE.get(norm(candidate));
    if (hit) return hit;
  }
  return null;
}

/** Resolves using only the label, returning null when nothing is recognised. */
function resolveFromLabel(label: string): string | null {
  const normLabel = norm(label);

  const exact = ALIAS_TO_CODE.get(normLabel);
  if (exact) return exact;

  // Embedded English abbreviation, e.g. "النسبة المعيارية الدولية INR" -> INR.
  for (const token of latinTokens(label)) {
    const hit = ALIAS_TO_CODE.get(norm(token));
    if (hit) return hit;
  }

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
    if (distinctHits.size > 1) return null;
  }

  for (const [aliasNorm, code] of ALIASES_BY_LENGTH) {
    if (aliasNorm.length < 4) continue;
    if (isUrineSpecimen && !code.startsWith("urine_")) continue;
    if (normLabel.includes(aliasNorm)) return code;
  }

  return null;
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
