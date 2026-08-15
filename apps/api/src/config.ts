export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret:
    process.env.SESSION_SECRET || "dev-secret-change-in-production",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  port: parseInt(process.env.API_PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
};
