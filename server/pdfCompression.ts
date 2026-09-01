import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Ghostscript is provisioned as a system package (see nixpacks.toml) rather
 * than an npm dependency — there is no maintained, trustworthy pure-JS
 * library that actually recompresses the embedded page images inside a
 * scanned PDF (pdf-lib only rewrites object/xref structure, which barely
 * touches a scanned report's size). The binary name differs by platform;
 * only "gs" needs to work in production (Linux via Railway/Nixpacks), the
 * Windows names are for local development only.
 */
const GHOSTSCRIPT_CANDIDATES = process.platform === "win32" ? ["gswin64c", "gswin32c", "gs"] : ["gs"];

/** 30s is generous for a single medical report; a hung/malformed PDF must never block the upload. */
const GHOSTSCRIPT_TIMEOUT_MS = 30_000;

let cachedBinary: string | null | undefined;

async function resolveGhostscriptBinary(): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary;

  for (const candidate of GHOSTSCRIPT_CANDIDATES) {
    try {
      await execFileAsync(candidate, ["-v"], { timeout: 5_000 });
      cachedBinary = candidate;
      return cachedBinary;
    } catch {
      // Try the next candidate name.
    }
  }

  cachedBinary = null;
  return null;
}

/**
 * A digitally signed PDF's byte range is cryptographically hashed —
 * recompressing it in any way (even lossless structural repacking)
 * invalidates the signature. Signature dictionaries are the only thing in
 * ordinary PDF usage that carry /ByteRange, so its presence is a reliable,
 * conservative signal to leave the file untouched.
 */
export function isDigitallySigned(buffer: Buffer): boolean {
  // Signatures live in the PDF's object dictionaries, which are always
  // plain ASCII/Latin-1 even when page content is binary — latin1 keeps a
  // 1:1 byte mapping so the search can't be thrown off by multi-byte
  // decoding of unrelated binary streams elsewhere in the file.
  const text = buffer.toString("latin1");
  return text.includes("/ByteRange");
}

/**
 * Recompresses a PDF with Ghostscript's "ebook" profile (~150dpi downsampled
 * images, JPEG-recompressed) — this only touches embedded raster images; the
 * text/vector content stream is preserved as-is, so a text-based PDF keeps
 * its searchable text and a scanned PDF keeps its page layout and page
 * count. Returns null (never throws) if Ghostscript isn't available or the
 * conversion fails for any reason — the caller falls back to the original
 * buffer so a compression problem can never block an upload.
 */
export async function compressPdf(buffer: Buffer): Promise<Buffer | null> {
  const binary = await resolveGhostscriptBinary();
  if (!binary) return null;

  const dir = await mkdtemp(join(tmpdir(), "medrec-pdf-"));
  const inputPath = join(dir, `${randomUUID()}.pdf`);
  const outputPath = join(dir, `${randomUUID()}.pdf`);

  try {
    await writeFile(inputPath, buffer);

    await execFileAsync(
      binary,
      [
        "-q",
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      { timeout: GHOSTSCRIPT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );

    return await readFile(outputPath);
  } catch (err) {
    console.error("[pdfCompression] Ghostscript compression failed, will store the original PDF:", err);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
