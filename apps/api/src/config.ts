export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret:
    process.env.SESSION_SECRET || "dev-secret-change-in-production",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  port: parseInt(process.env.API_PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  s3Endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  s3AccessKey: process.env.S3_ACCESS_KEY || "medisync",
  s3SecretKey: process.env.S3_SECRET_KEY || "medisync_dev",
  s3Bucket: process.env.S3_BUCKET || "medisync",
  s3Region: process.env.S3_REGION || "us-east-1",
};
