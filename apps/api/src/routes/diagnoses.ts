import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { diagnoses } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";

function buildPrompt(input: any): string {
  const { patientInfo, symptoms, existingConditions, symptomDuration, severity } = input;
  return `You are a medical AI assistant. Analyze the following patient information and provide a diagnosis.

Patient Information:
- Name: ${patientInfo.name}
- Age: ${patientInfo.age}
- Gender: ${patientInfo.gender}
- Weight: ${patientInfo.weight || "Not provided"}
- Height: ${patientInfo.height || "Not provided"}

Symptoms: ${symptoms.join(", ")}
Duration: ${symptomDuration || "Not specified"}
Severity: ${severity}

Medical History:
- Existing Conditions: ${existingConditions.length > 0 ? existingConditions.join(", ") : "None"}
- Allergies: ${patientInfo.allergies.length > 0 ? patientInfo.allergies.join(", ") : "None"}
- Current Medications: ${patientInfo.currentMedications.length > 0 ? patientInfo.currentMedications.join(", ") : "None"}

Please provide:
1. POSSIBLE DIAGNOSES (list 2-4 possible conditions with brief explanations)
2. IMMEDIATE SOLUTIONS (practical steps for relief)
3. RECOMMENDED TESTS (diagnostic tests to confirm)
4. WHEN TO SEEK EMERGENCY (red flag symptoms)
`;
}

function generateMockResponse(input: any): string {
  return `POSSIBLE DIAGNOSES:
Based on the symptoms (${input.symptoms.join(", ")}), possible conditions include:
1. Common viral infection - Most likely given the combination of symptoms
2. Stress-related condition - Consider if symptoms persist
3. Allergic reaction - If symptoms are seasonal or environment-related

IMMEDIATE SOLUTIONS:
1. Rest and stay hydrated
2. Over-the-counter pain relief if needed
3. Monitor symptoms for 24-48 hours
4. Keep a symptom diary

RECOMMENDED TESTS:
1. Complete Blood Count (CBC)
2. Basic Metabolic Panel
3. Consider allergy testing if symptoms persist

WHEN TO SEEK EMERGENCY:
- Difficulty breathing or chest pain
- High fever (above 103°F/39.4°C) lasting more than 3 days
- Severe headache with stiff neck
- Any sudden worsening of symptoms`;
}

async function callAI(input: any): Promise<string> {
  const prompt = buildPrompt(input);
  const aiEndpoint = config.openaiApiKey
    ? "https://api.openai.com/v1/chat/completions"
    : null;

  if (aiEndpoint && config.openaiApiKey) {
    try {
      const res = await fetch(aiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: config.openaiModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (err) {
      console.error("AI call failed, using mock:", err);
    }
  }

  return generateMockResponse(input);
}

export async function diagnosesRoutes(app: FastifyInstance) {
  app.get("/api/diagnoses", { preHandler: [requireAuth] }, async (request, reply) => {
    const data = await db
      .select()
      .from(diagnoses)
      .where(eq(diagnoses.userId, request.userId!));
    return reply.send({ diagnoses: data });
  });

  app.get("/api/diagnoses/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [d] = await db.select().from(diagnoses).where(eq(diagnoses.id, id)).limit(1);
    if (!d) return reply.status(404).send({ error: "Diagnosis not found" });
    if (d.userId !== request.userId) {
      return reply.status(403).send({ error: "Access denied" });
    }
    return reply.send({ diagnosis: d });
  });

  app.post("/api/diagnoses", { preHandler: [requireAuth] }, async (request, reply) => {
    const input = request.body as any;

    const patientInfo = input.patientInfo || { name: input.patient_name, age: input.age, gender: input.gender, weight: input.weight, height: input.height, allergies: input.allergies || [], currentMedications: input.current_medications || [] };
    const symptoms = input.symptoms || [];
    const existingConditions = input.existingConditions || input.existing_conditions || [];
    const symptomDuration = input.symptomDuration || input.symptom_duration || "";
    const severity = input.severity || "mild";

    if (!symptoms || symptoms.length === 0) {
      return reply.status(400).send({ error: "At least one symptom is required" });
    }

    const aiResponse = await callAI({ patientInfo, symptoms, existingConditions, symptomDuration, severity });

    const [d] = await db
      .insert(diagnoses)
      .values({
        userId: request.userId!,
        patientName: patientInfo.name,
        age: patientInfo.age,
        gender: patientInfo.gender,
        weight: patientInfo.weight || null,
        height: patientInfo.height || null,
        allergies: patientInfo.allergies || [],
        currentMedications: patientInfo.currentMedications || [],
        symptoms,
        existingConditions,
        symptomDuration,
        severity,
        aiResponse,
      })
      .returning();
    return reply.status(201).send({ diagnosis: d });
  });

  app.delete("/api/diagnoses/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [d] = await db.select({ userId: diagnoses.userId }).from(diagnoses).where(eq(diagnoses.id, id)).limit(1);
    if (!d) return reply.status(404).send({ error: "Diagnosis not found" });
    if (d.userId !== request.userId) {
      return reply.status(403).send({ error: "Access denied" });
    }
    await db.delete(diagnoses).where(eq(diagnoses.id, id));
    return reply.send({ ok: true });
  });
}
