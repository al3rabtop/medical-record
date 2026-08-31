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

/** Medical events are intentionally date-first, so the timeline never relies on upload time. */
export const medicalVisits = mysqlTable("medicalVisits", {
  id: int("id").autoincrement().primaryKey(),
  /** Owning account. Nullable temporarily to allow backfilling pre-existing rows. */
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  visitNumber: varchar("visitNumber", { length: 32 }).notNull().unique(),
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
  /** One-line plain-Arabic explanation of what this test measures. */
  about: varchar("about", { length: 400 }),
  status: mysqlEnum("status", ["reassuring", "follow_up", "unavailable"]).notNull().default("unavailable"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("medicalResults_visit_idx").on(table.visitId),
  index("medicalResults_code_idx").on(table.code),
  uniqueIndex("medicalResults_visit_code_idx").on(table.visitId, table.code),
]);

/** Original file references are kept private by the server and never returned in the public dashboard. */
export const medicalDocuments = mysqlTable("medicalDocuments", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().references(() => medicalVisits.id, { onDelete: "cascade" }),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("medicalDocuments_visit_idx").on(table.visitId)]);

export type MedicalVisit = typeof medicalVisits.$inferSelect;
export type MedicalResult = typeof medicalResults.$inferSelect;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;
