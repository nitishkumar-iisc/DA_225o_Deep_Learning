import Anthropic from "@anthropic-ai/sdk";
import { ParsedResume } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function parseResume(text: string): Promise<ParsedResume> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract structured data from this resume text. Return ONLY valid JSON with this exact schema:
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
- summary should be a concise professional summary.

Resume text:
${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const json = content.text.replace(/```json\n?|```\n?/g, "").trim();
  const parsed: ParsedResume = JSON.parse(json);

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
