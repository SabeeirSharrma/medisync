import { buildApp } from "./app.js";
import { config } from "./config.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: config.databaseUrl });
const db = drizzle(pool);

console.log("Running migrations...");
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}

try {
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`Server listening on port ${config.port}`);
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}
