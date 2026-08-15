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

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(sensible);

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(recordRoutes, { prefix: "/api" });
  await app.register(accessRequestRoutes, { prefix: "/api" });
  await app.register(exportRoutes, { prefix: "/api" });

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}
