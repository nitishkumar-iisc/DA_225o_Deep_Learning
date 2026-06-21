import Anthropic from "@anthropic-ai/sdk";
import { ParsedResume } from "@/types";

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

// Resume parsing prompt — returns structured candidate data (SPEC §6.1)
export async function parseResume(text: string): Promise<ParsedResume> {
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract structured information from this resume text. Return ONLY valid JSON matching the schema below. If a field cannot be determined, use null for strings and 0 for numbers.

Resume text:
${text}

Required JSON schema:
{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "skills": ["string"],
  "experienceYears": number,
  "educationLevel": "none | bachelor | master | phd",
  "workHistory": [{ "title": "string", "company": "string", "years": number }],
  "summary": "string (≤200 words)"
}

Infer experienceYears from work history if not stated. Return only the JSON object, no other text.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const jsonText = content.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(jsonText) as ParsedResume;
}

// Fit scoring prompt — evaluates candidate against job requirements (SPEC §6.2)
// Generic rubric evaluation so it works across different job types.
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

  const jsonText = content.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const result = JSON.parse(jsonText) as ClaudeScoreResult;

  // Clamp scores to [0, 1]
  result.keywordMatchScore = Math.min(Math.max(result.keywordMatchScore, 0), 1);
  result.claudeRawScore = Math.min(Math.max(result.claudeRawScore, 0), 1);

  return result;
}
