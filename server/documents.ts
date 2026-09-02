import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { medicalDocuments, medicalVisits } from "../drizzle/schema";
import { getDb } from "./db";
import { deleteObjects, isStorageConfigured, uploadObject } from "./_core/storage";
import { compressPdf, isDigitallySigned } from "./pdfCompression";

/**
 * SHA-256 of the raw file bytes exactly as uploaded — this is the "same
 * physical file" identity used for exact-duplicate detection. Always hash
 * the original bytes the client sent, never the compressed/re-encoded
 * output or any text extracted from it.
 */
export function hashFileContent(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Raw upload guard, before compression. Independent of the AI extraction limit — storing never touches the AI. */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
/** Bounds the longest side (width OR height) — most phone photos of a report are portrait, so height needs the same cap as width. */
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 80;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

export type StoredDocument = {
  id: number;
  visitId: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  /** When the file was uploaded/stored — not the same as the visit's examDate. */
  createdAt: Date;
  /** The exam/visit date of the medical record this document belongs to. */
  examDate: string;
};

/**
 * Compresses an image to a max of 1600px on its longest side (aspect ratio
 * preserved, never enlarged) and re-encodes as WebP @ 80% quality — small
 * enough to store cheaply while keeping medical text, numbers, and reference
 * ranges legible.
 *
 * PDFs go through Ghostscript (see pdfCompression.ts), which recompresses
 * the embedded page images without touching the text/vector content stream
 * — a scanned report shrinks, a text report keeps its searchable text, and
 * a signed PDF is left untouched since any recompression would invalidate
 * its signature. If Ghostscript is unavailable, fails, times out, or
 * produces a larger file than it started with, the original bytes are
 * stored — compression is a best-effort optimization, never a condition
 * for the upload to succeed.
 */
async function prepareForStorage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  if (mimeType === "application/pdf") {
    // A signed PDF's byte range is cryptographically hashed — any
    // recompression, however lossless, invalidates the signature.
    if (isDigitallySigned(buffer)) {
      return { buffer, mimeType, extension: "pdf" };
    }

    try {
      const compressed = await compressPdf(buffer);
      // Ghostscript can occasionally grow a file it re-encodes (e.g. a
      // scanned PDF whose images were already using a more efficient
      // encoding than the ebook profile's JPEG re-compression) — only
      // keep the result when it's a genuine improvement.
      if (compressed && compressed.length < buffer.length) {
        return { buffer: compressed, mimeType, extension: "pdf" };
      }
    } catch (err) {
      console.error("[documents] PDF compression failed, storing the original PDF:", err);
    }

    return { buffer, mimeType, extension: "pdf" };
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    const compressed = await sharp(buffer)
      .rotate() // bake in EXIF orientation before resizing, so rotated phone photos stay upright
      .resize({
        width: IMAGE_MAX_DIMENSION,
        height: IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
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

  // Hashed BEFORE compression — this must identify the exact bytes the user
  // uploaded, not whatever sharp/Ghostscript re-encodes them into.
  const contentHash = hashFileContent(file.buffer);

  const prepared = await prepareForStorage(file.buffer, file.mimeType);
  const key = `medical-documents/${userId}/${visitId}/${nanoid(16)}.${prepared.extension}`;
  await uploadObject(key, prepared.buffer, prepared.mimeType);

  const inserted = await db.insert(medicalDocuments).values({
    visitId,
    originalName: file.originalName.slice(0, 255),
    storageKey: key,
    mimeType: prepared.mimeType,
    fileSize: prepared.buffer.length,
    contentHash,
  });

  return { id: Number(inserted[0].insertId) };
}

/**
 * Finds an existing document with the exact same content hash, scoped to
 * this user's own documents — the security boundary for "is this file
 * already uploaded", since a hash match alone says nothing about ownership.
 */
export async function findDocumentByHash(
  userId: number,
  contentHash: string
): Promise<{ documentId: number; visitId: number } | null> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const rows = await db
    .select({ documentId: medicalDocuments.id, visitId: medicalDocuments.visitId })
    .from(medicalDocuments)
    .innerJoin(medicalVisits, eq(medicalDocuments.visitId, medicalVisits.id))
    .where(and(eq(medicalDocuments.contentHash, contentHash), eq(medicalVisits.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Lists stored documents across one or more visits, but only the ones that
 * belong to this user. A single test indicator (e.g. hemoglobin) can span
 * many visits over time, each with its own uploaded report, so callers pass
 * every visit id behind that indicator's history rather than just one.
 */
export async function listDocumentsForVisits(userId: number, visitIds: number[]): Promise<StoredDocument[]> {
  const uniqueIds = Array.from(new Set(visitIds));
  if (uniqueIds.length === 0) return [];

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  return db
    .select({
      id: medicalDocuments.id,
      visitId: medicalDocuments.visitId,
      originalName: medicalDocuments.originalName,
      mimeType: medicalDocuments.mimeType,
      fileSize: medicalDocuments.fileSize,
      createdAt: medicalDocuments.createdAt,
      examDate: medicalVisits.examDate,
    })
    .from(medicalDocuments)
    .innerJoin(medicalVisits, eq(medicalDocuments.visitId, medicalVisits.id))
    .where(and(inArray(medicalDocuments.visitId, uniqueIds), eq(medicalVisits.userId, userId)))
    .orderBy(desc(medicalDocuments.createdAt));
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

/**
 * Deletes every stored R2/S3 object belonging to the given visits, then
 * removes their medicalDocuments rows. MUST be called before the owning
 * medicalVisits rows are deleted: medicalDocuments has an ON DELETE CASCADE
 * foreign key to medicalVisits, so once the visit row is gone the database
 * silently drops the document metadata too — including the storageKey that
 * is the only way to find and delete the actual file. Without calling this
 * first, deleting a visit orphans every document it ever had in the bucket
 * forever, with no remaining record that they exist.
 *
 * Never throws on a storage failure: the caller (a user deleting their own
 * visit, or an admin removing an account) must still be able to complete
 * the database deletion even if the storage provider is temporarily
 * unavailable. Failures are returned in `failedKeys` so the caller can
 * decide how to surface them, instead of silently reporting success while
 * leaving an orphaned object behind.
 */
export async function deleteDocumentsForVisits(
  visitIds: number[]
): Promise<{ objectsDeleted: number; failedKeys: string[] }> {
  if (visitIds.length === 0) return { objectsDeleted: 0, failedKeys: [] };

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");

  const docs = await db
    .select({ storageKey: medicalDocuments.storageKey })
    .from(medicalDocuments)
    .where(inArray(medicalDocuments.visitId, visitIds));

  let objectsDeleted = 0;
  let failedKeys: string[] = [];

  if (docs.length > 0) {
    if (isStorageConfigured()) {
      const result = await deleteObjects(docs.map((d) => d.storageKey));
      objectsDeleted = result.deletedCount;
      failedKeys = result.failedKeys;
    } else {
      // Storage was never configured (e.g. local dev) — there is nothing to
      // delete from, but the caller must still know these keys were never
      // actually cleaned up, in case storage is configured later.
      console.error(
        `[documents] Storage not configured — skipping R2 cleanup for ${docs.length} document(s) about to be removed from the database.`
      );
      failedKeys = docs.map((d) => d.storageKey);
    }
  }

  // Explicit delete (not left to the visit's cascade) so the storage
  // cleanup above always runs against a still-accurate set of rows, and so
  // this function is self-contained and safe to call on its own.
  await db.delete(medicalDocuments).where(inArray(medicalDocuments.visitId, visitIds));

  return { objectsDeleted, failedKeys };
}
