import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing email/password auth.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 100 }).notNull(),
  name: text("name"),
  /** Patient's full name, shown in the app header. */
  patientName: varchar("patientName", { length: 160 }),
  /** Birth year only — day/month intentionally not collected. */
  birthYear: int("birthYear"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Suspended accounts cannot sign in, and existing sessions stop working. */
  status: mysqlEnum("status", ["pending", "active", "suspended"]).default("pending").notNull(),
  /** Lets an admin disable report uploads without suspending the whole account. */
  canUpload: boolean("canUpload").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** A person whose records are tracked: the account owner or a family member. */
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Owning account. Every profile belongs to exactly one user. */
  userId: int("userId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  /** Relationship to the account owner, e.g. "نفسي", "الوالدة", "ابني". */
  relation: varchar("relation", { length: 64 }),
  birthYear: int("birthYear"),
  /** The profile selected by default when the account signs in. */
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("profiles_userId_idx").on(table.userId)]);

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

/** Medical events are intentionally date-first, so the timeline never relies on upload time. */
export const medicalVisits = mysqlTable("medicalVisits", {
  id: int("id").autoincrement().primaryKey(),
  /** Owning account. Nullable temporarily to allow backfilling pre-existing rows. */
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  /** Which person this record belongs to. Nullable during backfill. */
  profileId: int("profileId"),
  visitNumber: varchar("visitNumber", { length: 32 }).notNull().unique(),
  /**
   * The HOSPITAL's own visit/encounter number as printed on the report
   * (e.g. "1594600"), when the extraction found one — distinct from
   * visitNumber above, which is an app-generated internal identifier and
   * never appears on any report. Matching visits by this field (when
   * present) is what makes "same hospital visit" detection reliable across
   * separately-uploaded reports, instead of relying on exam date alone.
   */
  hospitalVisitNumber: varchar("hospitalVisitNumber", { length: 64 }),
  /**
   * A patient identifier (e.g. MRN) read off the report, when visible. Used
   * only as a safety check: a new report claiming the same hospitalVisitNumber
   * but a DIFFERENT non-null patientIdentifier than what is already stored
   * for that visit is never auto-merged.
   */
  patientIdentifier: varchar("patientIdentifier", { length: 64 }),
  examDate: varchar("examDate", { length: 10 }).notNull(),
  reportDate: varchar("reportDate", { length: 10 }),
  reportType: varchar("reportType", { length: 64 }).notNull().default("تحاليل مختبرية"),
  department: varchar("department", { length: 128 }),
  physician: varchar("physician", { length: 128 }),
  facility: varchar("facility", { length: 160 }),
  source: varchar("source", { length: 128 }),
  testCount: int("testCount").notNull().default(0),
  abnormalCount: int("abnormalCount").notNull().default(0),
  summary: text("summary"),
  /** Plain-Arabic summary of a narrative report (radiology, pathology, consult). */
  summaryAr: text("summaryAr"),
  /** The original clinical text as written, for a physician reading the record. */
  clinicalText: text("clinicalText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("medicalVisits_examDate_idx").on(table.examDate),
  index("medicalVisits_userId_idx").on(table.userId),
  index("medicalVisits_profileId_idx").on(table.profileId),
  index("medicalVisits_hospitalVisitNumber_idx").on(table.hospitalVisitNumber),
]);

/** Numeric values are saved where possible, while valueText preserves the original report wording. */
export const medicalResults = mysqlTable("medicalResults", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().references(() => medicalVisits.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  numericValue: decimal("numericValue", { precision: 12, scale: 3 }),
  valueText: varchar("valueText", { length: 80 }).notNull(),
  unit: varchar("unit", { length: 32 }),
  referenceRange: varchar("referenceRange", { length: 80 }),
  /** Scientific/English short name, shown for clinicians. */
  abbr: varchar("abbr", { length: 120 }),
  /** Optional follow-up date the user recorded from their doctor's guidance. */
  followUpDate: varchar("followUpDate", { length: 10 }),
  /** One-line plain-Arabic explanation of what this test measures. */
  about: varchar("about", { length: 400 }),
  /**
   * The AI extraction's own self-reported confidence for this value, kept
   * for provenance so a later investigation into a suspicious value can see
   * whether the model already flagged it as unclear at extraction time.
   * Null for results entered manually or saved before this column existed.
   */
  confidence: mysqlEnum("confidence", ["high", "low"]),
  status: mysqlEnum("status", ["reassuring", "follow_up", "unavailable"]).notNull().default("unavailable"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("medicalResults_visit_idx").on(table.visitId),
  index("medicalResults_code_idx").on(table.code),
  uniqueIndex("medicalResults_visit_code_idx").on(table.visitId, table.code),
]);

/**
 * A compressed copy of the original uploaded report (image or PDF), kept so a
 * user can verify parsed data against the source without re-sending it to the
 * AI. References are kept private by the server and never returned in the
 * public dashboard — only through an authenticated, ownership-checked route.
 */
export const medicalDocuments = mysqlTable("medicalDocuments", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().references(() => medicalVisits.id, { onDelete: "cascade" }),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  /** Object key inside the S3/R2 bucket. */
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  /** MIME type of the STORED file (e.g. image/webp after compression), not necessarily the upload's original type. */
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  /** Size in bytes of the stored (compressed) file. */
  fileSize: int("fileSize").notNull().default(0),
  /**
   * SHA-256 of the RAW uploaded file bytes (before compression), hex-encoded.
   * This is what "the exact same file" means — never hashed from OCR text,
   * parsed JSON, or the compressed output, since the point is to recognize
   * the identical physical upload, not equivalent extracted content.
   * Nullable so pre-existing rows (uploaded before this column existed)
   * don't block a real migration.
   */
  contentHash: varchar("contentHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("medicalDocuments_visit_idx").on(table.visitId),
  index("medicalDocuments_contentHash_idx").on(table.contentHash),
]);

export type MedicalVisit = typeof medicalVisits.$inferSelect;
export type MedicalResult = typeof medicalResults.$inferSelect;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;
