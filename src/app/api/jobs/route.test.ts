import { NextRequest } from "next/server";
import { POST, GET } from "./route";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock Next.js `after` — it requires a request scope that doesn't exist in Jest
jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: jest.fn(),
}));

jest.mock("@/lib/auth-helpers", () => ({
  verifyAuth: jest.fn().mockResolvedValue({ uid: "recruiter1", role: "recruiter" }),
}));

// Atomic counter — simulates Firestore transaction serialisation.
// Each runTransaction invocation reads the current value, increments, and commits.
// Because Jest runs in a single thread, Promise.all interleaving still goes through
// this synchronous counter sequentially, guaranteeing uniqueness just as a real
// Firestore transaction would.
let _counter = 0;

jest.mock("@/lib/firebase-admin", () => {
  const jobs: Record<string, unknown> = {};

  return {
    adminDb: {
      collection: jest.fn((col: string) => ({
        doc: jest.fn((id?: string) => {
          const docId = id ?? `auto-${Math.random().toString(36).slice(2)}`;
          return {
            id: docId,
            get: jest.fn(async () => ({
              data: () => jobs[docId] ?? { positionId: "BH-2026-UNKNOWN", title: "Job" },
            })),
          };
        }),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [] }),
      })),

      runTransaction: jest.fn(async (fn: (tx: unknown) => Promise<string>) => {
        // Atomic read-increment-write — serialised even under Promise.all
        const seq = ++_counter;
        const tx = {
          get: jest.fn(async () => ({
            exists: seq > 1,
            data: () => ({ seq: seq - 1 }),
          })),
          set: jest.fn((ref: unknown, data: unknown) => {
            const r = ref as { id: string };
            if (r?.id) {
              (jobs as Record<string, unknown>)[r.id] = data;
            }
          }),
        };
        return fn(tx);
      }),
    },
    default: {},
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body?: object) {
  return new NextRequest("http://localhost:3000/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify(
      body ?? {
        title: "Software Engineer",
        department: "Engineering",
        description: "Build great things at scale.",
        requiredSkills: ["TypeScript", "React"],
        requiredExperienceYears: 3,
        educationLevel: "bachelor",
      }
    ),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _counter = 0;
  jest.clearAllMocks();
});

describe("POST /api/jobs — Position ID uniqueness", () => {
  it("generates unique Position IDs for 10 simultaneous requests", async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => POST(makeRequest()))
    );

    // All requests must succeed
    for (const resp of responses) {
      expect(resp.status).toBe(201);
    }

    const bodies = await Promise.all(responses.map((r) => r.json()));
    const ids = bodies.map((b: { positionId: string }) => b.positionId);

    // All 10 position IDs must be distinct
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });

  it("formats Position ID as BH-{YYYY}-{4-digit-seq}", async () => {
    const resp = await POST(makeRequest());
    expect(resp.status).toBe(201);

    const { positionId } = await resp.json() as { positionId: string };
    const year = new Date().getFullYear();
    expect(positionId).toMatch(new RegExp(`^BH-${year}-\\d{4}$`));
  });

  it("pads sequence number to 4 digits", async () => {
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => POST(makeRequest()))
    );
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const ids = bodies.map((b: { positionId: string }) => b.positionId);

    // e.g. BH-2026-0001, BH-2026-0002, BH-2026-0003
    ids.forEach((id) => {
      const seq = id.split("-")[2];
      expect(seq).toHaveLength(4);
    });
  });

  it("returns 201 with positionId in body", async () => {
    const resp = await POST(makeRequest());
    expect(resp.status).toBe(201);

    const body = await resp.json() as { positionId?: string };
    expect(body.positionId).toBeDefined();
    expect(typeof body.positionId).toBe("string");
  });
});

describe("POST /api/jobs — validation", () => {
  it("returns 400 when required fields are missing", async () => {
    const resp = await POST(
      new NextRequest("http://localhost:3000/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token" },
        body: JSON.stringify({ title: "Only a title" }), // missing required fields
      })
    );
    expect(resp.status).toBe(400);
  });
});

describe("GET /api/jobs", () => {
  it("returns 200 with empty jobs array when recruiter has no jobs", async () => {
    const req = new NextRequest("http://localhost:3000/api/jobs", {
      headers: { Authorization: "Bearer fake-token" },
    });
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const { jobs } = await resp.json() as { jobs: unknown[] };
    expect(Array.isArray(jobs)).toBe(true);
  });
});
