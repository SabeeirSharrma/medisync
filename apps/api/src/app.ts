import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import recordRoutes from "./routes/records.js";
import accessRequestRoutes from "./routes/access-requests.js";
import exportRoutes from "./routes/export.js";
import emergencyAccessRoutes from "./routes/emergency-access.js";
import guardianRoutes from "./routes/guardian.js";
import incapacityRoutes from "./routes/incapacity.js";
import deceasedRoutes from "./routes/deceased.js";
import aiRoutes from "./routes/ai.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.corsOrigin as string[],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(sensible);

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(recordRoutes, { prefix: "/api" });
  await app.register(accessRequestRoutes, { prefix: "/api" });
  await app.register(exportRoutes, { prefix: "/api" });
  await app.register(emergencyAccessRoutes, { prefix: "/api" });
  await app.register(guardianRoutes, { prefix: "/api" });
  await app.register(incapacityRoutes, { prefix: "/api" });
  await app.register(deceasedRoutes, { prefix: "/api" });
  await app.register(aiRoutes, { prefix: "/api" });

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}
