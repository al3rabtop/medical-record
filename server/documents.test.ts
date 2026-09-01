import { describe, expect, it } from "vitest";
import { hashFileContent } from "./documents";

describe("hashFileContent — exact-file-duplicate detection", () => {
  it("produces the same hash for identical bytes (uploading the same PDF twice)", () => {
    const bytes = Buffer.from("%PDF-1.4 fake report content for hashing test");
    expect(hashFileContent(bytes)).toBe(hashFileContent(Buffer.from(bytes)));
  });

  it("produces a different hash for even a single differing byte", () => {
    const a = Buffer.from("%PDF-1.4 report version A");
    const b = Buffer.from("%PDF-1.4 report version B");
    expect(hashFileContent(a)).not.toBe(hashFileContent(b));
  });

  it("is not affected by re-compression differences — it must be computed from the same raw bytes both times", () => {
    // This test documents the contract rather than exercising compression:
    // hashFileContent must always be called on the ORIGINAL upload bytes
    // (see server/documents.ts storeOriginalDocument and
    // server/_core/extract.ts), never on the compressed/re-encoded output,
    // or two uploads of the same original file could hash differently.
    const original = Buffer.from("original bytes");
    expect(hashFileContent(original)).toBe(hashFileContent(Buffer.from("original bytes")));
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashFileContent(Buffer.from("anything"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
