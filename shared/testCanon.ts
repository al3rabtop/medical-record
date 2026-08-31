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
  hemoglobin: ["الهيموغلوبين", "هيموغلوبين", "hemoglobin", "haemoglobin", "hb"],
  hematocrit: ["الهيماتوكريت", "هيماتوكريت", "hematocrit", "haematocrit", "hct", "pcv"],
  rbc: ["كريات الدم الحمراء", "الكريات الحمراء", "rbc", "redbloodcells", "erythrocytes"],
  wbc: ["كريات الدم البيضاء", "الكريات البيضاء", "wbc", "whitebloodcells", "leukocytes"],
  platelets: ["الصفائح الدموية", "صفائح", "platelets", "plt"],
  mcv: ["متوسط حجم الكرية", "mcv", "meancorpuscularvolume"],
  mch: ["متوسط هيموغلوبين الكرية", "mch", "meancorpuscularhemoglobin"],
  mchc: ["تركيز هيموغلوبين الكرية", "mchc"],
  rdw: ["تباين حجم الكريات", "rdw"],
  neutrophils: ["العدلات", "neutrophils", "neut"],
  lymphocytes: ["الخلايا اللمفاوية", "لمفاويات", "lymphocytes", "lym"],
  monocytes: ["الوحيدات", "monocytes", "mono"],
  eosinophils: ["الحمضات", "الخلايا الحمضية", "eosinophils", "eos"],
  basophils: ["الأسسات", "الخلايا القاعدية", "basophils", "baso"],

  ferritin: ["الفيريتين", "فيريتين", "ferritin"],
  iron: ["الحديد", "حديد المصل", "serumiron", "iron", "fe"],

  total_cholesterol: ["الكوليسترول الكلي", "كوليسترول كلي", "totalcholesterol", "cholesterol"],
  ldl: ["الكوليسترول الضار", "ldl", "ldlcholesterol"],
  hdl: ["الكوليسترول النافع", "hdl", "hdlcholesterol"],
  triglycerides: ["الدهون الثلاثية", "triglycerides", "tg"],

  hba1c: ["السكر التراكمي", "hba1c", "a1c", "glycatedhemoglobin"],
  glucose: ["سكر الدم الصائم", "الجلوكوز", "glucose", "fbg", "fastingglucose"],

  tsh: ["الهرمون المنبه للغدة الدرقية", "الهرمون المنبه للدرقية", "الهرمون المنشط للغدة الدرقية", "tsh", "thyroidstimulatinghormone", "thyrotropin"],
  total_t3: ["t3 الكلي", "totalt3", "t3"],
  total_t4: ["t4 الكلي", "totalt4", "t4"],
  free_t4: ["ft4", "freet4"],

  vitamin_d: ["فيتامين د", "vitamind", "25ohvitamind", "vitamind25oh"],
  vitamin_b12: ["فيتامين ب12", "فيتامين b12", "vitaminb12", "b12", "cobalamin"],
  calcium: ["الكالسيوم", "calcium", "ca"],

  creatinine: ["الكرياتينين", "creatinine", "cr"],
  // Kept separate from `creatinine` on purpose — different unit, see file header.
  creatinine_umol_l: [],
  urea: ["اليوريا", "urea", "bun"],
  egfr: ["egfr", "estimatedgfr"],
  uric_acid: ["حمض اليوريك", "uricacid"],

  alt: ["إنزيم alt", "alt", "sgpt", "alanineaminotransferase"],
  alt_u_l: [],
  ast: ["إنزيم ast", "ast", "sgot", "aspartateaminotransferase"],
  alp: ["الفوسفاتاز القلوية", "alkalinephosphatase", "alp"],
  bilirubin_total: ["البيليروبين الكلي", "totalbilirubin"],
  bilirubin_total_umol_l: [],
  bilirubin_direct: ["البيليروبين المباشر", "directbilirubin"],
  ggt: ["gammagt", "ggt", "gammaglutamyltransferase"],
  albumin: ["الألبومين", "albumin", "albuminserum"],
  globulin: ["الغلوبولين", "globulin"],
  total_protein: ["البروتين الكلي", "totalprotein"],

  inr: ["inr", "internationalnormalizedratio"],
  pt: ["زمن البروثرومبين", "prothrombintime", "pt"],
  aptt: ["aptt", "activatedpartialthromboplastintime"],

  sodium: ["الصوديوم", "sodium", "na"],
  potassium: ["البوتاسيوم", "potassium", "k"],
  magnesium: ["الماغنيسيوم", "magnesium", "mg"],
  cpk: ["كرياتين فوسفوكاينيز", "cpk", "creatinephosphokinase"],

  urine_wbc: ["كريات الدم البيضاء في البول", "uwbc", "urinewbc"],
  urine_rbc: ["كريات الدم الحمراء في البول", "urbc", "urinerbc"],
  urine_protein: ["بروتين البول", "urineprotein"],
  urine_glucose: ["جلوكوز البول", "urineglucose"],
  urine_ph: ["الحموضة", "urineph", "ph"],
  urine_specific_gravity: ["الكثافة النوعية", "specificgravity", "spgravity"],

  cea: ["cea", "carcinoembryonicantigen"],
};

const ALIAS_TO_CODE = new Map<string, string>();
for (const [code, aliases] of Object.entries(ALIAS_GROUPS)) {
  ALIAS_TO_CODE.set(norm(code), code);
  for (const alias of aliases) ALIAS_TO_CODE.set(norm(alias), code);
}

/**
 * Resolves a test to its canonical code. Tries the English abbreviation
 * first (most specific), then the Arabic/free-text label. Falls back to a
 * slug of the label so unrecognised tests still get a stable, unique code.
 */
export function resolveTestCode(label: string, abbr?: string | null): string {
  if (abbr) {
    // Strip a parenthetical like "Hemoglobin (Hb)" -> try both "hemoglobin" and "hb".
    const core = abbr.replace(/\([^)]*\)/g, " ").trim();
    const paren = abbr.match(/\(([^)]+)\)/)?.[1] ?? "";
    for (const candidate of [core, paren, abbr]) {
      const hit = ALIAS_TO_CODE.get(norm(candidate));
      if (hit) return hit;
    }
  }

  const labelHit = ALIAS_TO_CODE.get(norm(label));
  if (labelHit) return labelHit;

  // Unknown test: fall back to a slug derived from the label so it still
  // gets a stable code across saves of the exact same wording.
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^0-9a-zA-Z\u0600-\u06FF]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "result"
  );
}
