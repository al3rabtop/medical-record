import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
