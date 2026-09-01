export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** S3-compatible object storage for compressed original reports (works for AWS S3 or Cloudflare R2). */
  s3: {
    // Leave empty for AWS S3 (uses AWS's default endpoint resolution). Set to
    // `https://<account_id>.r2.cloudflarestorage.com` for Cloudflare R2.
    endpoint: process.env.S3_ENDPOINT ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.S3_BUCKET_NAME ?? "",
    // R2 has no regions and expects "auto"; real AWS S3 deployments must set S3_REGION.
    region: process.env.S3_REGION || "auto",
  },
};
