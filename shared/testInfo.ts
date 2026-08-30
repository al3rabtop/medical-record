/**
 * Human-friendly reference for lab tests.
 * - `abbr`: the scientific/English short name a physician would recognise.
 * - `about`: one plain-Arabic line explaining what the test is for.
 *
 * Keyed by the stored `code`. Falls back gracefully when a code is unknown,
 * so uploaded reports with new tests still render fine.
 */
export type TestInfo = { abbr: string; about: string };

export const TEST_INFO: Record<string, TestInfo> = {
  // الدم
  hemoglobin: { abbr: "Hemoglobin (Hb)", about: "يقيس قدرة الدم على نقل الأكسجين. انخفاضه يشير إلى فقر الدم." },
  hematocrit: { abbr: "Hematocrit (Hct)", about: "نسبة حجم كريات الدم الحمراء من إجمالي الدم." },
  rbc: { abbr: "Red Blood Cells (RBC)", about: "عدد كريات الدم الحمراء التي تحمل الأكسجين." },
  wbc: { abbr: "White Blood Cells (WBC)", about: "خلايا المناعة؛ ارتفاعها قد يدل على التهاب أو عدوى." },
  platelets: { abbr: "Platelets (PLT)", about: "مسؤولة عن تجلط الدم ووقف النزيف." },
  mcv: { abbr: "Mean Corpuscular Volume (MCV)", about: "متوسط حجم كرية الدم الحمراء، يساعد في تحديد نوع فقر الدم." },
  mch: { abbr: "Mean Corpuscular Hemoglobin (MCH)", about: "كمية الهيموغلوبين داخل الكرية الواحدة." },
  mchc: { abbr: "Mean Corpuscular Hb Concentration (MCHC)", about: "تركيز الهيموغلوبين داخل كريات الدم الحمراء." },
  rdw: { abbr: "Red Cell Distribution Width (RDW)", about: "مدى تفاوت أحجام كريات الدم الحمراء." },

  // الحديد والالتهاب
  ferritin: { abbr: "Ferritin", about: "مخزون الحديد في الجسم؛ يرتفع أيضاً مع الالتهاب." },

  // الدهون
  total_cholesterol: { abbr: "Total Cholesterol", about: "إجمالي الكوليسترول في الدم، مؤشر على صحة القلب والشرايين." },
  ldl: { abbr: "LDL Cholesterol", about: "الكوليسترول الضار؛ ارتفاعه يزيد خطر تصلب الشرايين." },
  hdl: { abbr: "HDL Cholesterol", about: "الكوليسترول النافع الذي يساعد على تنظيف الشرايين." },
  triglycerides: { abbr: "Triglycerides (TG)", about: "دهون في الدم ترتبط بالنظام الغذائي ووزن الجسم." },

  // السكر
  hba1c: { abbr: "Hemoglobin A1c (HbA1c)", about: "متوسط مستوى السكر خلال آخر ٣ أشهر." },
  glucose: { abbr: "Fasting Blood Glucose (FBG)", about: "مستوى السكر في الدم عند الصيام." },

  // الغدة الدرقية
  tsh: { abbr: "Thyroid Stimulating Hormone (TSH)", about: "الهرمون المنظّم لعمل الغدة الدرقية." },
  total_t3: { abbr: "Total Triiodothyronine (T3)", about: "أحد هرمونات الغدة الدرقية المؤثرة على الأيض والطاقة." },
  total_t4: { abbr: "Total Thyroxine (T4)", about: "الهرمون الرئيسي للغدة الدرقية." },
  free_t4: { abbr: "Free Thyroxine (FT4)", about: "الجزء الحر النشط من هرمون الغدة الدرقية." },

  // الفيتامينات والمعادن
  vitamin_d: { abbr: "Vitamin D (25-OH)", about: "مهم لصحة العظام والمناعة، ونقصه شائع جداً." },
  vitamin_b12: { abbr: "Vitamin B12 (Cobalamin)", about: "ضروري للأعصاب وتكوين كريات الدم الحمراء." },
  calcium: { abbr: "Calcium (Ca)", about: "معدن أساسي للعظام والأعصاب وعضلة القلب." },
  iron: { abbr: "Serum Iron (Fe)", about: "مستوى الحديد المتاح في الدم." },

  // الكلى
  creatinine: { abbr: "Creatinine (Cr)", about: "مؤشر رئيسي على كفاءة عمل الكلى." },
  creatinine_umol_l: { abbr: "Creatinine (Cr)", about: "مؤشر رئيسي على كفاءة عمل الكلى (بوحدة µmol/L)." },
  urea: { abbr: "Urea / BUN", about: "فضلات يتخلص منها الجسم عبر الكلى؛ ارتفاعها يشير إلى ضعف في وظائفها." },
  egfr: { abbr: "Estimated GFR (eGFR)", about: "معدل ترشيح الكلى المقدّر، يقيس كفاءتها بدقة." },

  // الكبد / الكيمياء الحيوية
  alt_u_l: { abbr: "Alanine Aminotransferase (ALT/SGPT)", about: "إنزيم كبدي؛ ارتفاعه يدل على إجهاد أو التهاب في الكبد." },
  alt: { abbr: "Alanine Aminotransferase (ALT/SGPT)", about: "إنزيم كبدي؛ ارتفاعه يدل على إجهاد أو التهاب في الكبد." },
  ast: { abbr: "Aspartate Aminotransferase (AST/SGOT)", about: "إنزيم يوجد في الكبد والعضلات." },
  alp: { abbr: "Alkaline Phosphatase (ALP)", about: "إنزيم مرتبط بالكبد والقنوات المرارية والعظام." },
  bilirubin_total_umol_l: { abbr: "Total Bilirubin", about: "ناتج تكسّر كريات الدم الحمراء؛ ارتفاعه يسبب اصفرار الجلد." },
  albumin: { abbr: "Albumin", about: "بروتين رئيسي ينتجه الكبد ويعكس الحالة الغذائية." },

  // البروتينات
  globulin: { abbr: "Globulin", about: "مجموعة بروتينات مرتبطة بالمناعة ووظائف الكبد." },
  total_protein: { abbr: "Total Protein", about: "إجمالي البروتين في الدم." },

  // تخثر الدم
  inr: { abbr: "International Normalized Ratio (INR)", about: "يقيس سرعة تجلط الدم، مهم لمن يتناول مميعات." },
  pt: { abbr: "Prothrombin Time (PT)", about: "الزمن الذي يستغرقه الدم ليتجلط." },
  aptt: { abbr: "Activated Partial Thromboplastin Time (APTT)", about: "اختبار آخر لقياس كفاءة تجلط الدم." },

  // البول
  urine_wbc: { abbr: "Urine WBC", about: "كريات بيضاء في البول؛ ارتفاعها قد يدل على التهاب بولي." },
  urine_rbc: { abbr: "Urine RBC", about: "كريات حمراء في البول." },
  urine_protein: { abbr: "Urine Protein", about: "وجود بروتين في البول قد يشير إلى مشكلة في الكلى." },

  // مؤشرات ورمية
  cea: { abbr: "Carcinoembryonic Antigen (CEA)", about: "مؤشر يُستخدم في متابعة بعض الحالات، ويُقرأ دائماً مع بقية الفحوصات." },
};

export function getTestInfo(code: string): TestInfo | null {
  return TEST_INFO[code] ?? null;
}
