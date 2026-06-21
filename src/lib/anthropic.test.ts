import { parseResume } from "./anthropic";

// ── Mock the Anthropic SDK ────────────────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockResponse(parsed: object, wrapInFence = false) {
  const text = wrapInFence
    ? "```json\n" + JSON.stringify(parsed) + "\n```"
    : JSON.stringify(parsed);
  mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text }] });
}

const FULL_RESUME: object = {
  name: "Alice Chen",
  email: "alice@example.com",
  phone: "+1-555-0101",
  skills: ["TypeScript", "React", "Node.js"],
  experienceYears: 5,
  educationLevel: "bachelor",
  workHistory: [{ title: "Engineer", company: "Acme", years: 5 }],
  summary: "Experienced full-stack engineer.",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parseResume — prompt structure", () => {
  beforeEach(() => mockCreate.mockClear());

  it("includes all required JSON schema field names in the prompt", async () => {
    mockResponse(FULL_RESUME);
    await parseResume("sample resume text");

    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;

    const requiredFields = [
      '"name"',
      '"email"',
      '"phone"',
      '"skills"',
      '"experienceYears"',
      '"educationLevel"',
      '"workHistory"',
      '"summary"',
    ];
    for (const field of requiredFields) {
      expect(prompt).toContain(field);
    }
  });

  it("instructs Claude to infer experienceYears from work history", async () => {
    mockResponse(FULL_RESUME);
    await parseResume("sample resume text");

    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt.toLowerCase()).toContain("infer");
  });

  it("instructs Claude to return null for undetermined fields", async () => {
    mockResponse(FULL_RESUME);
    await parseResume("sample resume text");

    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt.toLowerCase()).toContain("null");
  });

  it("passes the resume text to Claude", async () => {
    mockResponse(FULL_RESUME);
    const resumeText = "UNIQUE_RESUME_MARKER_XYZ";
    await parseResume(resumeText);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain(resumeText);
  });
});

describe("parseResume — response parsing", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("returns a fully populated ParsedResume for a complete response", async () => {
    mockResponse(FULL_RESUME);
    const result = await parseResume("full resume");

    expect(result.name).toBe("Alice Chen");
    expect(result.email).toBe("alice@example.com");
    expect(result.skills).toEqual(["TypeScript", "React", "Node.js"]);
    expect(result.experienceYears).toBe(5);
    expect(result.educationLevel).toBe("bachelor");
    expect(result.workHistory).toHaveLength(1);
    expect(result.summary).toBe("Experienced full-stack engineer.");
  });

  it("handles all-null optional fields without throwing", async () => {
    mockResponse({
      name: null,
      email: null,
      phone: null,
      skills: [],
      experienceYears: 0,
      educationLevel: "none",
      workHistory: [],
      summary: "",
    });

    const result = await parseResume("empty resume");
    expect(result.name).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.skills).toEqual([]);
    expect(result.workHistory).toEqual([]);
  });

  it("strips markdown code fences from the response", async () => {
    mockResponse(FULL_RESUME, true /* wrapInFence */);
    const result = await parseResume("resume with fence");
    expect(result.name).toBe("Alice Chen");
  });

  it("normalizes an unknown educationLevel to 'none'", async () => {
    mockResponse({ ...FULL_RESUME, educationLevel: "associate" });
    const result = await parseResume("unknown edu");
    expect(result.educationLevel).toBe("none");
  });

  it("coerces a null experienceYears to 0", async () => {
    mockResponse({ ...FULL_RESUME, experienceYears: null });
    const result = await parseResume("no exp");
    expect(result.experienceYears).toBe(0);
  });

  it("coerces missing skills to an empty array", async () => {
    const { skills: _removed, ...rest } = FULL_RESUME as Record<string, unknown>;
    mockResponse({ ...rest, skills: null });
    const result = await parseResume("no skills");
    expect(result.skills).toEqual([]);
  });

  it("accepts all valid educationLevel values", async () => {
    for (const level of ["none", "bachelor", "master", "phd"]) {
      mockResponse({ ...FULL_RESUME, educationLevel: level });
      const result = await parseResume(`resume with ${level}`);
      expect(result.educationLevel).toBe(level);
    }
  });
});
