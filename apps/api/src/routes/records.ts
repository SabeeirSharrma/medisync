import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { records } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export async function recordsRoutes(app: FastifyInstance) {
  app.get("/api/records", { preHandler: [requireAuth] }, async (request, reply) => {
    const data = await db
      .select()
      .from(records)
      .where(eq(records.patientId, request.userId!));
    return reply.send({ records: data });
  });

  app.get("/api/records/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [record] = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!record) return reply.status(404).send({ error: "Record not found" });
    if (record.patientId !== request.userId) {
      return reply.status(403).send({ error: "Access denied" });
    }
    return reply.send({ record });
  });

  app.post("/api/records", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const [record] = await db
      .insert(records)
      .values({
        patientId: request.userId!,
        type: body.type as string,
        date: body.date as string,
        doctorName: body.doctor_name as string || null,
        hospitalName: body.hospital_name as string || null,
        details: body.details || {},
        attachmentUrl: body.attachment_url as string || null,
        contentType: body.content_type as string || null,
        fileSize: body.file_size as number || null,
      })
      .returning();
    return reply.status(201).send({ record });
  });

  app.delete("/api/records/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [record] = await db.select({ patientId: records.patientId }).from(records).where(eq(records.id, id)).limit(1);
    if (!record) return reply.status(404).send({ error: "Record not found" });
    if (record.patientId !== request.userId) {
      return reply.status(403).send({ error: "Access denied" });
    }
    await db.delete(records).where(eq(records.id, id));
    return reply.send({ ok: true });
  });

  app.post("/api/records/:id/upload", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [record] = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!record) return reply.status(404).send({ error: "Record not found" });

    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "No file provided" });

    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { config } = await import("../config.js");
    const { s3 } = await import("../lib/s3.js");

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const key = `records/${id}/${file.filename}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: file.mimetype,
      })
    );

    const attachmentUrl = `${config.s3Endpoint}/${config.s3Bucket}/${key}`;
    await db
      .update(records)
      .set({
        attachmentUrl,
        contentType: file.mimetype,
        fileSize: buffer.length,
        updatedAt: new Date(),
      })
      .where(eq(records.id, id));

    return reply.send({ attachmentUrl });
  });
}
