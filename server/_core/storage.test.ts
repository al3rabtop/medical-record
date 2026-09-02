import { beforeEach, describe, expect, it, vi } from "vitest";

// ENV (server/_core/env.ts) reads process.env at import time, so these must
// be set before ./storage (which imports ENV) is ever imported below.
process.env.S3_BUCKET_NAME = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  DeleteObjectsCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
}));

const { deleteObjects } = await import("./storage");

describe("deleteObjects — deletion of medical documents from R2/S3", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("does nothing and never calls the provider for an empty key list", async () => {
    const result = await deleteObjects([]);
    expect(result).toEqual({ deletedCount: 0, failedKeys: [] });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("reports every key the provider confirms as deleted", async () => {
    sendMock.mockResolvedValueOnce({ Deleted: [{ Key: "a" }, { Key: "b" }], Errors: [] });
    const result = await deleteObjects(["a", "b"]);
    expect(result).toEqual({ deletedCount: 2, failedKeys: [] });
  });

  it("surfaces a per-key provider error as failed, never as silently deleted", async () => {
    sendMock.mockResolvedValueOnce({
      Deleted: [{ Key: "a" }],
      Errors: [{ Key: "b", Code: "AccessDenied", Message: "denied" }],
    });
    const result = await deleteObjects(["a", "b"]);
    expect(result).toEqual({ deletedCount: 1, failedKeys: ["b"] });
  });

  it("treats a thrown request (e.g. network timeout) as every key in it failing, not deleted", async () => {
    sendMock.mockRejectedValueOnce(new Error("network timeout"));
    const result = await deleteObjects(["x", "y"]);
    expect(result.deletedCount).toBe(0);
    expect(result.failedKeys).toEqual(["x", "y"]);
  });

  it("chunks a key list larger than 1000 into multiple DeleteObjects requests", async () => {
    sendMock.mockResolvedValue({ Deleted: [], Errors: [] });
    const keys = Array.from({ length: 2500 }, (_, i) => `key-${i}`);
    await deleteObjects(keys);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });
});
