import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises storeOriginalDocument's exact-duplicate race handling without a
 * real database or S3/R2 client: getDb() and the storage module are mocked,
 * and every drizzle chain call (`.select().from().where().limit()`, etc.) is
 * represented by a thenable proxy that resolves/rejects with a canned value
 * regardless of which specific method in the chain the caller awaits from —
 * this only needs to prove the CONTROL FLOW in documents.ts is correct
 * (pre-check → upload → insert → duplicate-key fallback → cleanup), not
 * re-verify drizzle or the AWS SDK themselves.
 */

function chain(result: unknown, shouldReject = false): any {
  const proxy: any = new Proxy(function chainNode() {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          shouldReject ? reject(result) : resolve(result);
      }
      return (..._args: unknown[]) => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

const selectMock = vi.fn();
const insertMock = vi.fn();
const dbMock = { select: selectMock, insert: insertMock };

vi.mock("./db", () => ({ getDb: async () => dbMock }));

const uploadObjectMock = vi.fn();
const deleteObjectsMock = vi.fn();
vi.mock("./_core/storage", () => ({
  isStorageConfigured: () => true,
  uploadObject: uploadObjectMock,
  deleteObjects: deleteObjectsMock,
}));

vi.mock("./pdfCompression", () => ({
  compressPdf: async (buf: Buffer) => buf,
  isDigitallySigned: () => false,
}));

const { storeOriginalDocument } = await import("./documents");

const OWNED_VISIT = [{ id: 42 }];
const FILE = { buffer: Buffer.from("%PDF-1.4 test content"), mimeType: "application/pdf", originalName: "report.pdf" };

describe("storeOriginalDocument — exact-duplicate race handling", () => {
  beforeEach(() => {
    selectMock.mockReset();
    insertMock.mockReset();
    uploadObjectMock.mockReset().mockResolvedValue(undefined);
    deleteObjectsMock.mockReset().mockResolvedValue({ deletedCount: 1, failedKeys: [] });
  });

  it("stores normally when nothing matches the hash yet", async () => {
    selectMock
      .mockReturnValueOnce(chain(OWNED_VISIT)) // ownership check
      .mockReturnValueOnce(chain([])); // pre-insert findDocumentByHash: no match
    insertMock.mockReturnValueOnce(chain([{ insertId: 7 }]));

    const result = await storeOriginalDocument(1, 42, FILE);

    expect(result).toEqual({ id: 7 });
    expect(uploadObjectMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("skips upload/insert entirely when the pre-check already finds this exact file", async () => {
    selectMock
      .mockReturnValueOnce(chain(OWNED_VISIT)) // ownership check
      .mockReturnValueOnce(chain([{ documentId: 99, visitId: 42 }])); // pre-check: already stored

    const result = await storeOriginalDocument(1, 42, FILE);

    expect(result).toEqual({ id: 99 });
    expect(uploadObjectMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("on a lost race (duplicate-key insert failure), cleans up the orphaned object and returns the winning row instead of throwing", async () => {
    selectMock
      .mockReturnValueOnce(chain(OWNED_VISIT)) // ownership check
      .mockReturnValueOnce(chain([])) // pre-check: no match yet (raced)
      .mockReturnValueOnce(chain([{ documentId: 55, visitId: 42 }])); // post-failure re-check: the winner

    const dupError = Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
    insertMock.mockReturnValueOnce(chain(dupError, true));

    const result = await storeOriginalDocument(1, 42, FILE);

    expect(result).toEqual({ id: 55 });
    expect(uploadObjectMock).toHaveBeenCalledTimes(1); // the object that lost the race was still uploaded
    expect(deleteObjectsMock).toHaveBeenCalledTimes(1); // ...and is cleaned up rather than left orphaned
  });

  it("rethrows a non-duplicate-key insert failure rather than masking a real error", async () => {
    selectMock
      .mockReturnValueOnce(chain(OWNED_VISIT))
      .mockReturnValueOnce(chain([]));

    const realError = new Error("connection reset");
    insertMock.mockReturnValueOnce(chain(realError, true));

    await expect(storeOriginalDocument(1, 42, FILE)).rejects.toThrow("connection reset");
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });
});
