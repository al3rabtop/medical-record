import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { ENV } from "./env";

let client: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(ENV.s3.bucket && ENV.s3.accessKeyId && ENV.s3.secretAccessKey);
}

function getClient(): S3Client {
  if (client) return client;
  if (!isStorageConfigured()) {
    throw new Error("S3/R2 storage is not configured (missing S3_BUCKET_NAME / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY).");
  }
  client = new S3Client({
    region: ENV.s3.region,
    endpoint: ENV.s3.endpoint || undefined,
    // A custom endpoint (R2, MinIO, etc.) needs path-style addressing; real
    // AWS S3 (no custom endpoint) uses its default virtual-hosted style.
    forcePathStyle: Boolean(ENV.s3.endpoint),
    credentials: {
      accessKeyId: ENV.s3.accessKeyId,
      secretAccessKey: ENV.s3.secretAccessKey,
    },
  });
  return client;
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: ENV.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Fetches an object for streaming back to an already-authenticated, ownership-checked caller. */
export async function getObjectStream(key: string): Promise<GetObjectCommandOutput> {
  return getClient().send(
    new GetObjectCommand({
      Bucket: ENV.s3.bucket,
      Key: key,
    })
  );
}

/**
 * Deletes a batch of objects by key. Never called with a client-supplied
 * key — every caller resolves keys itself from ownership-checked database
 * rows first. Chunked at 1000 keys (the S3/R2 DeleteObjects limit per
 * request). Never throws: a failed key is reported back in `failedKeys`
 * rather than aborting the whole batch or the caller's database cleanup,
 * so a storage-provider hiccup can never silently pretend every file was
 * removed, but also never traps a user's own delete action forever behind
 * a transient storage failure.
 */
export async function deleteObjects(keys: string[]): Promise<{ deletedCount: number; failedKeys: string[] }> {
  if (keys.length === 0) return { deletedCount: 0, failedKeys: [] };

  const client = getClient();
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) chunks.push(keys.slice(i, i + 1000));

  let deletedCount = 0;
  const failedKeys: string[] = [];

  for (const chunk of chunks) {
    try {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: ENV.s3.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: false },
        })
      );
      deletedCount += result.Deleted?.length ?? 0;
      for (const err of result.Errors ?? []) {
        if (err.Key) failedKeys.push(err.Key);
      }
    } catch (err) {
      console.error("[storage] Batch object deletion failed:", err);
      failedKeys.push(...chunk);
    }
  }

  return { deletedCount, failedKeys };
}
