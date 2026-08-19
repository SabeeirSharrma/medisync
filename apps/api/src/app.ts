import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { recordsRoutes } from "./routes/records.js";
import { diagnosesRoutes } from "./routes/diagnoses.js";
import { accessRequestsRoutes } from "./routes/access-requests.js";
import { emergencyAccessRoutes } from "./routes/emergency-access.js";
import { guardianRoutes } from "./routes/guardian.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  });

  await app.register(sensible);

  // Health check
  app.get("/api/health", async () => ({ status: "ok" }));

  // Routes
  await app.register(authRoutes);
  await app.register(recordsRoutes);
  await app.register(diagnosesRoutes);
  await app.register(accessRequestsRoutes);
  await app.register(emergencyAccessRoutes);
  await app.register(guardianRoutes);

  return app;
}
