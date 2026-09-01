import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { medicalDocuments, medicalVisits } from "../drizzle/schema";
import { getDb } from "./db";
import { isStorageConfigured, uploadObject } from "./_core/storage";

/** Raw upload guard, before compression. Independent of the AI extraction limit — storing never touches the AI. */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_WIDTH = 1600;
const IMAGE_QUALITY = 80;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

export type StoredDocument = {
  id: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
};

/**
 * Compresses an image to a max width of 1600px (aspect ratio preserved) and
 * re-encodes as WebP @ 80% quality — small enough to store cheaply while
 * keeping medical text, numbers, and reference ranges legible. PDFs are
 * preserved byte-for-byte: no PDF compression/conversion library exists in
 * this project, and introducing one is unnecessary for the goal (a verifiable
 * copy of the source), so they pass through unchanged.
 */
async function prepareForStorage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  if (mimeType === "application/pdf") {
    return { buffer, mimeType, extension: "pdf" };
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    const compressed = await sharp(buffer)
      .rotate() // bake in EXIF orientation before resizing, so rotated phone photos stay upright
      .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();
    return { buffer: compressed, mimeType: "image/webp", extension: "webp" };
  }

  throw new Error("نوع الملف غير مدعوم للتخزين. يُسمح فقط بصور أو ملفات PDF.");
}

/**
 * Stores a compressed copy of the original report against a visit the user
 * owns. Runs entirely independently of AI extraction — no model call here,
 * and viewing the stored file later never re-sends it to the AI.
 */
export async function storeOriginalDocument(
  userId: number,
  visitId: number,
  file: { buffer: Buffer; mimeType: string; originalName: string }
): Promise<{ id: number }> {
  if (!isStorageConfigured()) {
    throw new Error("تخزين الملفات غير مُفعّل حالياً على الخادم.");
  }
  if (file.buffer.length === 0) {
    throw new Error("الملف فارغ.");
  }
  if (file.buffer.length > MAX_DOCUMENT_BYTES) {
    throw new Error(`حجم الملف كبير جداً (الحد ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} ميجابايت).`);
  }

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const owned = await db
    .select({ id: medicalVisits.id })
    .from(medicalVisits)
    .where(and(eq(medicalVisits.id, visitId), eq(medicalVisits.userId, userId)))
    .limit(1);
  if (owned.length === 0) {
    throw new Error("السجل غير موجود أو لا تملك صلاحية الوصول إليه.");
  }

  const prepared = await prepareForStorage(file.buffer, file.mimeType);
  const key = `medical-documents/${userId}/${visitId}/${nanoid(16)}.${prepared.extension}`;
  await uploadObject(key, prepared.buffer, prepared.mimeType);

  const inserted = await db.insert(medicalDocuments).values({
    visitId,
    originalName: file.originalName.slice(0, 255),
    storageKey: key,
    mimeType: prepared.mimeType,
    fileSize: prepared.buffer.length,
  });

  return { id: Number(inserted[0].insertId) };
}

/** Lists stored documents for a visit, but only when it belongs to this user. */
export async function listDocumentsForVisit(userId: number, visitId: number): Promise<StoredDocument[]> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db
    .select({
      id: medicalDocuments.id,
      originalName: medicalDocuments.originalName,
      mimeType: medicalDocuments.mimeType,
      fileSize: medicalDocuments.fileSize,
      createdAt: medicalDocuments.createdAt,
    })
    .from(medicalDocuments)
    .innerJoin(medicalVisits, eq(medicalDocuments.visitId, medicalVisits.id))
    .where(and(eq(medicalDocuments.visitId, visitId), eq(medicalVisits.userId, userId)));
}

/**
 * Resolves a document for download, but only when the requesting user owns
 * the visit it belongs to. This is the security boundary for the
 * "View Original Report" route — never trust a document id alone.
 */
export async function getOwnedDocument(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const rows = await db
    .select({
      id: medicalDocuments.id,
      storageKey: medicalDocuments.storageKey,
      mimeType: medicalDocuments.mimeType,
      originalName: medicalDocuments.originalName,
    })
    .from(medicalDocuments)
    .innerJoin(medicalVisits, eq(medicalDocuments.visitId, medicalVisits.id))
    .where(and(eq(medicalDocuments.id, documentId), eq(medicalVisits.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}
