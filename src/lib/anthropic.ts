import Anthropic from "@anthropic-ai/sdk";
import { ParsedResume } from "@/types";

// mammoth ships without TS declarations; require + inline type avoids the error.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
};

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export interface ClaudeScoreResult {
  keywordMatchScore: number;
  claudeRawScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  reasoning: string;
}

const RESUME_PARSE_PROMPT = `Extract structured data from this resume. Return ONLY valid JSON with this exact schema:
{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "skills": ["string"],
  "experienceYears": number,
  "educationLevel": "none" | "bachelor" | "master" | "phd",
  "workHistory": [{"title": "string", "company": "string", "years": number}],
  "summary": "string (max 200 words)"
}

Rules:
- Infer experienceYears from work history if not explicitly stated.
- Return null for any field you cannot determine.
- educationLevel must be one of: none, bachelor, master, phd.
- summary should be a concise professional summary.`;

function normalizeResume(parsed: ParsedResume): ParsedResume {
  return {
    name: parsed.name ?? null,
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    experienceYears: Number(parsed.experienceYears) || 0,
    educationLevel: ["none", "bachelor", "master", "phd"].includes(parsed.educationLevel)
      ? parsed.educationLevel
      : "none",
    workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory : [],
    summary: parsed.summary ?? "",
  };
}

// Parse a resume PDF buffer directly — no PDF parsing library needed.
// Claude reads the PDF natively via the document content type.
export async function parseResumeFromPDF(buffer: Buffer): Promise<ParsedResume> {
  const client = getClient();

  // The document block type isn't in all SDK overloads' union, so we cast the array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: buffer.toString("base64"),
      },
    },
    { type: "text", text: RESUME_PARSE_PROMPT },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const first = response.content[0];
  if (first.type !== "text") throw new Error("Unexpected response type from Claude");

  const json = first.text.replace(/```json\n?|```\n?/g, "").trim();
  return normalizeResume(JSON.parse(json));
}

// Parse a DOCX or DOC resume buffer — mammoth extracts plain text, Claude parses it.
export async function parseResumeFromDocx(buffer: Buffer): Promise<ParsedResume> {
  const { value: text } = await mammoth.extractRawText({ buffer });
  if (!text.trim()) throw new Error("Could not extract text from document");
  return parseResume(text);
}

// Parse a plain-text resume (TXT files).
export async function parseResumeFromText(buffer: Buffer): Promise<ParsedResume> {
  const text = buffer.toString("utf-8");
  if (!text.trim()) throw new Error("Document appears to be empty");
  return parseResume(text);
}

// Parse a resume from extracted plain text (used when text is already available).
export async function parseResume(text: string): Promise<ParsedResume> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${RESUME_PARSE_PROMPT}\n\nResume text:\n${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const json = content.text.replace(/```json\n?|```\n?/g, "").trim();
  return normalizeResume(JSON.parse(json));
}

// Fit scoring prompt — evaluates candidate against job requirements (SPEC §6.2)
// Generic rubric so it works across different job types.
// Claude MUST return exactly this JSON schema (no extra fields).
export async function scoreJobFit(
  resumeSummary: {
    skills: string[];
    experienceYears: number;
    educationLevel: string;
    workHistory: { title: string; company: string; years: number }[];
    summary: string;
  },
  job: {
    title: string;
    description: string;
    requiredSkills: string[];
    requiredExperienceYears: number;
    educationLevel: string;
  }
): Promise<ClaudeScoreResult> {
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are an expert recruiter evaluating a candidate's fit for a job opening. Assess the match holistically based on skills, experience, and background.

Job title: ${job.title}
Job description: ${job.description}
Required skills: ${job.requiredSkills.join(", ")}
Required experience: ${job.requiredExperienceYears} years
Required education: ${job.educationLevel}

Candidate profile:
Skills: ${resumeSummary.skills.join(", ")}
Total experience: ${resumeSummary.experienceYears} years
Education: ${resumeSummary.educationLevel}
Work history: ${resumeSummary.workHistory.map((w) => `${w.title} at ${w.company} (${w.years}y)`).join("; ")}
Summary: ${resumeSummary.summary}

Return ONLY valid JSON matching this exact schema (no extra fields, no markdown):
{
  "keywordMatchScore": <number 0-1, fraction of required skills/keywords present in candidate profile>,
  "claudeRawScore": <number 0-1, your holistic confidence this candidate is a good fit>,
  "matchedKeywords": [<required skills/keywords found in candidate profile>],
  "missingKeywords": [<required skills/keywords absent from candidate profile>],
  "reasoning": "<your assessment in ≤100 words>"
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const jsonText = content.text.replace(/```json\n?|```\n?/g, "").trim();
  const result = JSON.parse(jsonText) as ClaudeScoreResult;

  // Clamp scores to [0, 1]
  result.keywordMatchScore = Math.min(Math.max(result.keywordMatchScore, 0), 1);
  result.claudeRawScore = Math.min(Math.max(result.claudeRawScore, 0), 1);

  return result;
}
