import type { Express, Request, Response } from "express";
import type { Readable } from "stream";
import { authenticateRequest } from "./auth";
import { getOwnedDocument, storeOriginalDocument } from "../documents";
import { getObjectStream } from "./storage";

/** Base64 inflates by ~33%; bounds the request body independently of the AI extraction limit. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Registers the storage side of the upload flow: saving a compressed copy of
 * the original report next to a visit, and serving it back only to the user
 * who owns it. Neither route calls the AI — extraction already happened
 * (or never happens at all, for a plain "store the file" case), and viewing
 * a stored document is pure storage I/O.
 */
export function registerDocumentRoutes(app: Express) {
  app.post("/api/reports/document", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول" });
      return;
    }
    if (!user.canUpload) {
      res.status(403).json({ error: "تم إيقاف رفع التقارير لهذا الحساب." });
      return;
    }

    const { visitId, fileData, mediaType, originalName } = (req.body ?? {}) as {
      visitId?: number;
      fileData?: string;
      mediaType?: string;
      originalName?: string;
    };

    if (!visitId || !fileData || !mediaType || !originalName) {
      res.status(400).json({ error: "بيانات الملف ناقصة" });
      return;
    }

    const approxBytes = Math.floor((fileData.length * 3) / 4);
    if (approxBytes > MAX_UPLOAD_BYTES) {
      res.status(413).json({
        error: `حجم الملف كبير جداً (الحد ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت).`,
      });
      return;
    }

    try {
      const buffer = Buffer.from(fileData, "base64");
      const { id } = await storeOriginalDocument(user.id, Number(visitId), {
        buffer,
        mimeType: mediaType,
        originalName,
      });
      res.json({ success: true, documentId: id });
    } catch (err) {
      console.error("[documents] store failed:", err);
      const message = err instanceof Error ? err.message : "تعذّر حفظ نسخة من التقرير الأصلي.";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول" });
      return;
    }

    const documentId = Number(req.params.id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      res.status(400).json({ error: "معرّف غير صالح" });
      return;
    }

    try {
      // Ownership is re-checked on every fetch — a document id alone never
      // grants access, only one that resolves to a visit this user owns.
      const doc = await getOwnedDocument(user.id, documentId);
      if (!doc) {
        res.status(404).json({ error: "الملف غير موجود" });
        return;
      }

      const object = await getObjectStream(doc.storageKey);
      res.setHeader("Content-Type", doc.mimeType);
      // Private cache only — this is a medical document, never shared or public.
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="report"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`
      );
      if (object.ContentLength) res.setHeader("Content-Length", String(object.ContentLength));

      if (!object.Body) {
        res.status(404).json({ error: "الملف غير موجود" });
        return;
      }
      (object.Body as Readable).pipe(res);
    } catch (err) {
      console.error("[documents] fetch failed:", err);
      if (!res.headersSent) res.status(500).json({ error: "تعذّر تحميل الملف." });
    }
  });
}
