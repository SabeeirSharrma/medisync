import OpenAI from "openai";
import { config } from "../config.js";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!config.openaiApiKey) {
    throw new Error(
      "OpenAI API key not configured. Set OPENAI_API_KEY environment variable to enable AI features.",
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return _client;
}

function isAvailable(): boolean {
  return !!config.openaiApiKey;
}

export interface PatientSummary {
  summary: string;
  keyFindings: string[];
  recordTypesAnalyzed: string[];
  dateRange: { from: string; to: string };
  recordsAnalyzed: number;
}

export interface RecordSummary {
  summary: string;
  keyFindings: string[];
  recordType: string;
}

function formatRecordForPrompt(record: {
  type: string;
  date: string;
  doctorName: string | null;
  hospitalName: string | null;
  details: Record<string, unknown>;
}): string {
  const parts: string[] = [
    `Type: ${record.type}`,
    `Date: ${record.date}`,
  ];
  if (record.doctorName) parts.push(`Doctor: ${record.doctorName}`);
  if (record.hospitalName) parts.push(`Hospital: ${record.hospitalName}`);
  if (record.details && Object.keys(record.details).length > 0) {
    parts.push(`Details: ${JSON.stringify(record.details, null, 2)}`);
  }
  return parts.join("\n");
}

export async function summarizePatientRecords(
  patientName: string,
  records: Array<{
    type: string;
    date: string;
    doctorName: string | null;
    hospitalName: string | null;
    details: Record<string, unknown>;
  }>,
  filters?: { recordTypes?: string[]; dateFrom?: string; dateTo?: string },
): Promise<PatientSummary> {
  if (!isAvailable()) {
    return {
      summary:
        "AI summarization is not available. Configure OPENAI_API_KEY to enable this feature.",
      keyFindings: [],
      recordTypesAnalyzed: [...new Set(records.map((r) => r.type))],
      dateRange: {
        from: filters?.dateFrom ?? "all",
        to: filters?.dateTo ?? "all",
      },
      recordsAnalyzed: records.length,
    };
  }

  const formattedRecords = records.map(formatRecordForPrompt).join("\n\n---\n\n");

  const systemPrompt = `You are a medical records assistant. Analyze the provided medical records for patient "${patientName}" and produce a concise, structured summary.

IMPORTANT: You are NOT providing medical advice. You are summarizing documented medical records for the patient's own review.

Return your response as JSON with this exact structure:
{
  "summary": "A 2-4 sentence overview of the patient's medical history based on these records.",
  "keyFindings": ["Finding 1", "Finding 2", ...]
}

Key findings should be specific, factual observations from the records (e.g., "Prescribed metformin for Type 2 diabetes on 2024-01-15", "MRI on 2024-03-01 showed no abnormalities"). Limit to 5-8 key findings.`;

  const userPrompt = `Medical records for ${patientName} (${records.length} records):\n\n${formattedRecords}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 1024,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as {
    summary?: string;
    keyFindings?: string[];
  };

  return {
    summary: parsed.summary ?? "No summary generated.",
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    recordTypesAnalyzed: [...new Set(records.map((r) => r.type))],
    dateRange: {
      from: filters?.dateFrom ?? (records.length > 0 ? records[records.length - 1].date : "all"),
      to: filters?.dateTo ?? (records.length > 0 ? records[0].date : "all"),
    },
    recordsAnalyzed: records.length,
  };
}

export async function summarizeRecord(
  record: {
    type: string;
    date: string;
    doctorName: string | null;
    hospitalName: string | null;
    details: Record<string, unknown>;
  },
  includeHistory: boolean = false,
): Promise<RecordSummary> {
  if (!isAvailable()) {
    return {
      summary:
        "AI summarization is not available. Configure OPENAI_API_KEY to enable this feature.",
      keyFindings: [],
      recordType: record.type,
    };
  }

  const formattedRecord = formatRecordForPrompt(record);

  const systemPrompt = `You are a medical records assistant. Analyze this specific medical record and produce a concise summary.

IMPORTANT: You are NOT providing medical advice. You are summarizing documented medical information for the patient's own review.

Return your response as JSON with this exact structure:
{
  "summary": "A 2-3 sentence summary of this medical record.",
  "keyFindings": ["Finding 1", "Finding 2", ...]
}

Key findings should be specific and factual. Limit to 3-5 findings.`;

  const userPrompt = `Medical record:\n\n${formattedRecord}`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 512,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as {
    summary?: string;
    keyFindings?: string[];
  };

  return {
    summary: parsed.summary ?? "No summary generated.",
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    recordType: record.type,
  };
}
