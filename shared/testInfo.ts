/**
 * Human-friendly reference for lab tests.
 * - `abbr`: the scientific/English short name a physician would recognise.
 * - `about`: one plain-Arabic line explaining what the test is for.
 *
 * Keyed by the stored `code`. Falls back gracefully when a code is unknown,
 * so uploaded reports with new tests still render fine.
 */
export type TestInfo = {
  abbr: string;
  about: string;
  /** Why a clinician typically orders this test — general education, not interpretation. */
  why?: string;
  /** The same context in clinical English, for a physician reading the record. */
  clinical?: string;
};

export const TEST_INFO: Record<string, TestInfo> = {
  // الدم
  hemoglobin: { abbr: "Hemoglobin (Hb)", about: "يقيس قدرة الدم على نقل الأكسجين. انخفاضه يشير إلى فقر الدم.", why: "يُطلب عادةً للكشف عن فقر الدم ومتابعة علاجه، أو عند أعراض مثل التعب والدوخة وشحوب البشرة، وكذلك قبل العمليات الجراحية.", clinical: "Ordered to screen for and monitor anaemia, evaluate fatigue, pallor or dizziness, and as part of routine pre-operative assessment." },
  hematocrit: { abbr: "Hematocrit (Hct)", about: "نسبة حجم كريات الدم الحمراء من إجمالي الدم.", why: "يُطلب مع الهيموغلوبين لتقييم فقر الدم أو الجفاف، ولمتابعة الحالات التي تؤثر على كريات الدم الحمراء.", clinical: "Ordered alongside haemoglobin to assess anaemia, dehydration, and conditions affecting red cell mass." },
  rbc: { abbr: "Red Blood Cells (RBC)", about: "عدد كريات الدم الحمراء التي تحمل الأكسجين." },
  wbc: { abbr: "White Blood Cells (WBC)", about: "خلايا المناعة؛ ارتفاعها قد يدل على التهاب أو عدوى.", why: "يُطلب عند الاشتباه بعدوى أو التهاب، ولمتابعة أمراض الدم وتأثير بعض الأدوية على المناعة.", clinical: "Ordered when infection or inflammation is suspected, and to monitor haematological disease or drug effects on the marrow." },
  platelets: { abbr: "Platelets (PLT)", about: "مسؤولة عن تجلط الدم ووقف النزيف.", why: "يُطلب لتقييم القدرة على تجلط الدم، خاصة عند النزيف أو الكدمات المتكررة أو قبل العمليات.", clinical: "Ordered to assess bleeding risk, particularly with easy bruising or bleeding, and before surgical procedures." },
  mcv: { abbr: "Mean Corpuscular Volume (MCV)", about: "متوسط حجم كرية الدم الحمراء، يساعد في تحديد نوع فقر الدم.", why: "يُطلب لتحديد نوع فقر الدم، إذ يساعد حجم الكرية على التفريق بين نقص الحديد ونقص فيتامين ب12 وغيرها.", clinical: "Ordered to classify anaemia; red cell size helps distinguish iron deficiency from B12/folate deficiency and other causes." },
  mch: { abbr: "Mean Corpuscular Hemoglobin (MCH)", about: "كمية الهيموغلوبين داخل الكرية الواحدة." },
  mchc: { abbr: "Mean Corpuscular Hb Concentration (MCHC)", about: "تركيز الهيموغلوبين داخل كريات الدم الحمراء." },
  rdw: { abbr: "Red Cell Distribution Width (RDW)", about: "مدى تفاوت أحجام كريات الدم الحمراء.", why: "يُطلب مع صورة الدم لتقييم تفاوت أحجام الكريات، ويساعد في تحديد سبب فقر الدم.", clinical: "Ordered with the CBC to assess red cell size variability, aiding the differential diagnosis of anaemia." },

  // الحديد والالتهاب
  ferritin: { abbr: "Ferritin", about: "مخزون الحديد في الجسم؛ يرتفع أيضاً مع الالتهاب.", why: "يُطلب لتقييم مخزون الحديد عند الاشتباه بفقر دم نقص الحديد أو زيادة الحديد، ويرتفع أيضاً في حالات الالتهاب.", clinical: "Ordered to assess iron stores in suspected iron deficiency or overload; also rises as an acute-phase reactant in inflammation." },

  // الدهون
  total_cholesterol: { abbr: "Total Cholesterol", about: "إجمالي الكوليسترول في الدم، مؤشر على صحة القلب والشرايين.", why: "يُطلب لتقييم خطر أمراض القلب والشرايين، ولمتابعة فعالية الحمية أو أدوية خفض الدهون.", clinical: "Ordered for cardiovascular risk assessment and to monitor response to diet or lipid-lowering therapy." },
  ldl: { abbr: "LDL Cholesterol", about: "الكوليسترول الضار؛ ارتفاعه يزيد خطر تصلب الشرايين.", why: "يُطلب لتقييم خطر تصلب الشرايين، وهو الهدف الرئيسي لعلاج الدهون.", clinical: "Ordered for atherosclerotic risk stratification; the primary target of lipid-lowering treatment." },
  hdl: { abbr: "HDL Cholesterol", about: "الكوليسترول النافع الذي يساعد على تنظيف الشرايين.", why: "يُطلب ضمن تقييم الدهون، إذ يرتبط ارتفاعه بانخفاض خطر أمراض القلب.", clinical: "Ordered as part of the lipid panel; higher levels are associated with lower cardiovascular risk." },
  triglycerides: { abbr: "Triglycerides (TG)", about: "دهون في الدم ترتبط بالنظام الغذائي ووزن الجسم.", why: "يُطلب ضمن تقييم الدهون وخطر القلب، ويتأثر بشكل كبير بالطعام والوزن والسكري.", clinical: "Ordered within the lipid panel; strongly influenced by diet, weight and glycaemic control." },

  // السكر
  hba1c: { abbr: "Hemoglobin A1c (HbA1c)", about: "متوسط مستوى السكر خلال آخر ٣ أشهر.", why: "يُطلب لتشخيص السكري ومتابعته، إذ يعكس متوسط السكر خلال ٣ أشهر دون الحاجة للصيام.", clinical: "Ordered to diagnose and monitor diabetes; reflects average glycaemia over ~3 months without fasting." },
  glucose: { abbr: "Fasting Blood Glucose (FBG)", about: "مستوى السكر في الدم عند الصيام.", why: "يُطلب لتشخيص ارتفاع أو انخفاض السكر، وعادةً بعد صيام ٨ ساعات.", clinical: "Ordered to detect hyper- or hypoglycaemia, typically after an 8-hour fast." },

  // الغدة الدرقية
  tsh: { abbr: "Thyroid Stimulating Hormone (TSH)", about: "الهرمون المنظّم لعمل الغدة الدرقية.", why: "يُطلب كفحص أول لوظائف الغدة الدرقية عند أعراض مثل التعب أو تغير الوزن أو تساقط الشعر.", clinical: "First-line thyroid function test, ordered for fatigue, weight change, hair loss or suspected thyroid disease." },
  total_t3: { abbr: "Total Triiodothyronine (T3)", about: "أحد هرمونات الغدة الدرقية المؤثرة على الأيض والطاقة.", why: "يُطلب مع TSH لتقييم فرط نشاط الغدة الدرقية بشكل أدق.", clinical: "Ordered with TSH to further characterise suspected hyperthyroidism." },
  total_t4: { abbr: "Total Thyroxine (T4)", about: "الهرمون الرئيسي للغدة الدرقية.", why: "يُطلب مع TSH لتأكيد اضطرابات الغدة الدرقية وتحديد شدتها.", clinical: "Ordered with TSH to confirm and grade thyroid dysfunction." },
  free_t4: { abbr: "Free Thyroxine (FT4)", about: "الجزء الحر النشط من هرمون الغدة الدرقية.", why: "يُطلب مع TSH لتقييم الجزء النشط من هرمون الغدة الدرقية.", clinical: "Ordered with TSH to assess the metabolically active fraction of thyroxine." },

  // الفيتامينات والمعادن
  vitamin_d: { abbr: "Vitamin D (25-OH)", about: "مهم لصحة العظام والمناعة، ونقصه شائع جداً.", why: "يُطلب عند آلام العظام أو التعب المزمن أو هشاشة العظام، ونقصه شائع جداً في المنطقة.", clinical: "Ordered for bone pain, chronic fatigue or osteoporosis workup; deficiency is highly prevalent regionally." },
  vitamin_b12: { abbr: "Vitamin B12 (Cobalamin)", about: "ضروري للأعصاب وتكوين كريات الدم الحمراء.", why: "يُطلب عند التنميل أو التعب أو فقر الدم كبير الكريات، وخاصة لدى النباتيين أو مستخدمي بعض أدوية المعدة.", clinical: "Ordered for paraesthesia, fatigue or macrocytic anaemia; particularly in vegetarians and long-term metformin or PPI users." },
  calcium: { abbr: "Calcium (Ca)", about: "معدن أساسي للعظام والأعصاب وعضلة القلب.", why: "يُطلب لتقييم صحة العظام والغدة الجار درقية، وعند أعراض عصبية أو عضلية.", clinical: "Ordered to assess bone and parathyroid status, and for neuromuscular symptoms." },
  iron: { abbr: "Serum Iron (Fe)", about: "مستوى الحديد المتاح في الدم.", why: "يُطلب مع الفيريتين لتقييم نقص أو زيادة الحديد.", clinical: "Ordered with ferritin to evaluate iron deficiency or overload." },

  // الكلى
  creatinine: { abbr: "Creatinine (Cr)", about: "مؤشر رئيسي على كفاءة عمل الكلى.", why: "يُطلب لتقييم وظائف الكلى، ومتابعة مرضى الضغط والسكري، وقبل صرف بعض الأدوية.", clinical: "Ordered to assess renal function, monitor hypertensive and diabetic patients, and before nephrotoxic or renally-cleared drugs." },
  creatinine_umol_l: { abbr: "Creatinine (Cr)", about: "مؤشر رئيسي على كفاءة عمل الكلى (بوحدة µmol/L).", why: "يُطلب لتقييم وظائف الكلى، ومتابعة مرضى الضغط والسكري، وقبل صرف بعض الأدوية.", clinical: "Ordered to assess renal function, monitor hypertensive and diabetic patients, and before nephrotoxic or renally-cleared drugs." },
  urea: { abbr: "Urea / BUN", about: "فضلات يتخلص منها الجسم عبر الكلى؛ ارتفاعها يشير إلى ضعف في وظائفها.", why: "يُطلب مع الكرياتينين لتقييم وظائف الكلى وحالة السوائل في الجسم.", clinical: "Ordered with creatinine to assess renal function and hydration status." },
  egfr: { abbr: "Estimated GFR (eGFR)", about: "معدل ترشيح الكلى المقدّر، يقيس كفاءتها بدقة.", why: "يُطلب لتقدير كفاءة الترشيح الكلوي وتحديد مرحلة أمراض الكلى المزمنة.", clinical: "Ordered to estimate glomerular filtration and stage chronic kidney disease." },

  // الكبد / الكيمياء الحيوية
  alt_u_l: { abbr: "Alanine Aminotransferase (ALT/SGPT)", about: "إنزيم كبدي؛ ارتفاعه يدل على إجهاد أو التهاب في الكبد.", why: "يُطلب لتقييم صحة الكبد، وعند متابعة أدوية قد تؤثر عليه، أو عند الاشتباه بالتهاب أو دهون الكبد.", clinical: "Ordered to assess hepatocellular injury, monitor hepatotoxic drugs, and evaluate suspected hepatitis or fatty liver." },
  alt: { abbr: "Alanine Aminotransferase (ALT/SGPT)", about: "إنزيم كبدي؛ ارتفاعه يدل على إجهاد أو التهاب في الكبد.", why: "يُطلب لتقييم صحة الكبد، وعند متابعة أدوية قد تؤثر عليه، أو عند الاشتباه بالتهاب أو دهون الكبد.", clinical: "Ordered to assess hepatocellular injury, monitor hepatotoxic drugs, and evaluate suspected hepatitis or fatty liver." },
  ast: { abbr: "Aspartate Aminotransferase (AST/SGOT)", about: "إنزيم يوجد في الكبد والعضلات.", why: "يُطلب مع ALT لتقييم الكبد، وقد يرتفع أيضاً مع إجهاد العضلات.", clinical: "Ordered with ALT for hepatic assessment; may also rise with muscle injury." },
  alp: { abbr: "Alkaline Phosphatase (ALP)", about: "إنزيم مرتبط بالكبد والقنوات المرارية والعظام.", why: "يُطلب لتقييم القنوات المرارية والعظام، وعند اليرقان أو آلام العظام.", clinical: "Ordered to evaluate cholestasis and bone turnover, and in jaundice or bone pain." },
  bilirubin_total_umol_l: { abbr: "Total Bilirubin", about: "ناتج تكسّر كريات الدم الحمراء؛ ارتفاعه يسبب اصفرار الجلد.", why: "يُطلب عند اصفرار الجلد أو العين، ولتقييم وظائف الكبد والقنوات المرارية.", clinical: "Ordered for jaundice and to evaluate hepatic and biliary function." },
  albumin: { abbr: "Albumin", about: "بروتين رئيسي ينتجه الكبد ويعكس الحالة الغذائية.", why: "يُطلب لتقييم الحالة الغذائية ووظيفة الكبد المزمنة.", clinical: "Ordered to assess nutritional status and chronic hepatic synthetic function." },

  // البروتينات
  globulin: { abbr: "Globulin", about: "مجموعة بروتينات مرتبطة بالمناعة ووظائف الكبد.", why: "يُطلب ضمن تقييم البروتينات، ويرتبط بحالة المناعة والكبد.", clinical: "Ordered within protein studies; relates to immune and hepatic status." },
  total_protein: { abbr: "Total Protein", about: "إجمالي البروتين في الدم.", why: "يُطلب لتقييم الحالة الغذائية العامة ووظائف الكبد والكلى.", clinical: "Ordered to assess overall nutritional state and hepatic/renal function." },

  // تخثر الدم
  inr: { abbr: "International Normalized Ratio (INR)", about: "يقيس سرعة تجلط الدم، مهم لمن يتناول مميعات.", why: "يُطلب لمتابعة مميعات الدم مثل الوارفارين، وقبل العمليات، ولتقييم وظائف الكبد.", clinical: "Ordered to monitor warfarin therapy, before procedures, and to assess hepatic synthetic function." },
  pt: { abbr: "Prothrombin Time (PT)", about: "الزمن الذي يستغرقه الدم ليتجلط.", why: "يُطلب لتقييم مسار التجلط الخارجي، وقبل العمليات الجراحية.", clinical: "Ordered to assess the extrinsic coagulation pathway and for pre-operative screening." },
  aptt: { abbr: "Activated Partial Thromboplastin Time (APTT)", about: "اختبار آخر لقياس كفاءة تجلط الدم.", why: "يُطلب لتقييم مسار التجلط الداخلي، ومتابعة الهيبارين.", clinical: "Ordered to assess the intrinsic pathway and monitor heparin therapy." },

  // البول
  urine_wbc: { abbr: "Urine WBC", about: "كريات بيضاء في البول؛ ارتفاعها قد يدل على التهاب بولي.", why: "يُطلب عند الاشتباه بالتهاب المسالك البولية أو أعراض مثل الحرقة وتكرار التبول.", clinical: "Ordered when urinary tract infection is suspected, or for dysuria and urinary frequency." },
  urine_rbc: { abbr: "Urine RBC", about: "كريات حمراء في البول.", why: "يُطلب عند وجود دم في البول أو للاشتباه بحصى أو التهاب.", clinical: "Ordered for haematuria, suspected calculi or urinary tract inflammation." },
  urine_protein: { abbr: "Urine Protein", about: "وجود بروتين في البول قد يشير إلى مشكلة في الكلى.", why: "يُطلب للكشف المبكر عن اعتلال الكلى، خاصة لدى مرضى السكري والضغط.", clinical: "Ordered to screen for nephropathy, particularly in diabetes and hypertension." },

  // مؤشرات ورمية
  cea: { abbr: "Carcinoembryonic Antigen (CEA)", about: "مؤشر يُستخدم في متابعة بعض الحالات، ويُقرأ دائماً مع بقية الفحوصات.", why: "يُطلب لمتابعة بعض الحالات الورمية بعد التشخيص، ولا يُستخدم وحده للتشخيص.", clinical: "Ordered for surveillance of certain malignancies after diagnosis; not used alone as a diagnostic test." },
};

export function getTestInfo(code: string): TestInfo | null {
  return TEST_INFO[code] ?? null;
}
