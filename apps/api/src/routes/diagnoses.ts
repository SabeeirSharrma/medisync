import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { diagnoses } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";

interface DiagnosisInput {
  patientInfo: {
    name: string;
    age: number;
    gender: string;
    weight?: number | string | null;
    height?: number | string | null;
    allergies?: string[];
    currentMedications?: string[];
  };
  symptoms: string[];
  existingConditions: string[];
  symptomDuration: string;
  severity: string;
}

const SYSTEM_PROMPT = `You are MediSync's clinical decision-support assistant: an evidence-based medical AI whose output is reviewed by patients and clinicians.
Analyze the patient data and respond ONLY with genuine clinical content in exactly these five sections, using these exact headers in this order:

CLINICAL SUMMARY:
POSSIBLE DIAGNOSES:
IMMEDIATE SOLUTIONS:
RECOMMENDED TESTS:
WHEN TO SEEK EMERGENCY:

Rules:
- Base every statement strictly on the provided symptoms, history, and demographics; never invent findings that were not given.
- Rank differential diagnoses by likelihood with brief clinical reasoning (key symptoms, epidemiology, pathophysiology).
- Recommend standard first-line investigations and management consistent with current clinical guidelines.
- List concrete red-flag symptoms that warrant emergency care.
- Do not output any text outside the five sections.
- End the final section with this exact line: "This is not a medical diagnosis. Consult a licensed physician."`;

function buildPrompt(input: DiagnosisInput): string {
  const { patientInfo, symptoms, existingConditions, symptomDuration, severity } = input;
  return `Patient Information:
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
- Allergies: ${patientInfo.allergies && patientInfo.allergies.length > 0 ? patientInfo.allergies.join(", ") : "None"}
- Current Medications: ${patientInfo.currentMedications && patientInfo.currentMedications.length > 0 ? patientInfo.currentMedications.join(", ") : "None"}

Provide the clinical analysis in the required sections.`;
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

async function callAI(input: DiagnosisInput): Promise<string> {
  if (!config.aiApiKey) {
    if (config.aiMock) return generateMockResponse(input);
    throw new Error("AI_API_KEY is not configured");
  }

  const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.aiApiKey}`,
      "HTTP-Referer": config.corsOrigin[0] || "http://localhost:3000",
      "X-Title": "MediSync",
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(input) },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI provider returned ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty response");
  return content;
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

    let aiResponse: string;
    try {
      aiResponse = await callAI({ patientInfo, symptoms, existingConditions, symptomDuration, severity });
    } catch (err) {
      console.error("AI diagnosis generation failed:", err);
      return reply.status(502).send({ error: "AI diagnosis service is unavailable. Please try again later." });
    }

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
