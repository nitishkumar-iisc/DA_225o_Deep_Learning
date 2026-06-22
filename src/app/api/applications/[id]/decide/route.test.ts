import { NextRequest } from "next/server";
import { PATCH } from "./route";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth-helpers", () => ({
  verifyAuth: jest.fn().mockResolvedValue({ uid: "recruiter1", role: "recruiter" }),
}));

// Shared mutable state for Firestore mock — overridden per test
let _appData: Record<string, unknown> = {};

const mockAppRef = {
  get: jest.fn(async () => ({ exists: true, data: () => _appData })),
  update: jest.fn().mockResolvedValue({}),
};

const mockJobRef = {
  get: jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ recruiterId: "recruiter1", title: "Software Engineer", positionId: "BH-2026-0001" }),
  }),
};

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn((col: string) => ({
      doc: jest.fn(() => (col === "applications" ? mockAppRef : mockJobRef)),
    })),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeApp(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "app1",
    candidateId: "cand1",
    jobId: "job1",
    resumeId: "res1",
    fitScore: 75,
    featureVector: {},
    claudeReasoning: "Good fit.",
    status: "pending",
    decision: null,
    decidedAt: null,
    scheduledAt: null,
    calendarEventId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRequest(body: object) {
  return new NextRequest("http://localhost:3000/api/applications/app1/decide", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token" },
    body: JSON.stringify(body),
  });
}

const PARAMS = { params: Promise.resolve({ id: "app1" }) };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/applications/[id]/decide — undo lock", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 409 when undo is attempted after 30-minute window", async () => {
    _appData = makeApp({
      status: "approved",
      decision: "approved",
      decidedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 min ago
    });

    const req = makeRequest({ decision: "undo" });
    const resp = await PATCH(req, PARAMS);

    expect(resp.status).toBe(409);
    const body = await resp.json();
    expect(body.error).toMatch(/undo window/i);
  });

  it("allows undo within the 30-minute window", async () => {
    _appData = makeApp({
      status: "approved",
      decision: "approved",
      decidedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    });

    const req = makeRequest({ decision: "undo" });
    const resp = await PATCH(req, PARAMS);

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.decision).toBe("undo");
  });

  it("returns 400 when there is no decision to undo", async () => {
    _appData = makeApp({ status: "pending", decision: null, decidedAt: null });

    const req = makeRequest({ decision: "undo" });
    const resp = await PATCH(req, PARAMS);

    expect(resp.status).toBe(400);
  });

  it("resets status to pending on successful undo", async () => {
    _appData = makeApp({
      status: "approved",
      decision: "approved",
      decidedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    });

    const req = makeRequest({ decision: "undo" });
    await PATCH(req, PARAMS);

    const updateCall = mockAppRef.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateCall.status).toBe("pending");
    expect(updateCall.decision).toBeNull();
    expect(updateCall.decidedAt).toBeNull();
  });
});

describe("PATCH /api/applications/[id]/decide — calendar behavior", () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fires POST /api/calendar/schedule when decision is approved", async () => {
    _appData = makeApp();

    const req = makeRequest({ decision: "approved" });
    const resp = await PATCH(req, PARAMS);
    expect(resp.status).toBe(200);

    // fire-and-forget: wait one tick for the un-awaited fetch to be called
    await new Promise((r) => setImmediate(r));

    const calendarCalls = mockFetch.mock.calls.filter(
      ([url]) => typeof url === "string" && (url as string).includes("/api/calendar/schedule")
    );
    expect(calendarCalls.length).toBeGreaterThanOrEqual(1);
    expect(calendarCalls[0][1]?.method).toBe("POST");
  });

  it("does NOT fire /api/calendar/schedule when decision is rejected", async () => {
    _appData = makeApp();

    const req = makeRequest({ decision: "rejected" });
    const resp = await PATCH(req, PARAMS);
    expect(resp.status).toBe(200);

    await new Promise((r) => setImmediate(r));

    const calendarCalls = mockFetch.mock.calls.filter(
      ([url]) => typeof url === "string" && (url as string).includes("/api/calendar/schedule")
    );
    expect(calendarCalls.length).toBe(0);
  });

  it("fires DELETE /api/calendar/schedule on undo when calendarEventId exists", async () => {
    _appData = makeApp({
      status: "interview_scheduled",
      decision: "approved",
      decidedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      calendarEventId: "evt-abc123",
    });

    const req = makeRequest({ decision: "undo" });
    const resp = await PATCH(req, PARAMS);
    expect(resp.status).toBe(200);

    await new Promise((r) => setImmediate(r));

    const calendarCalls = mockFetch.mock.calls.filter(
      ([url]) => typeof url === "string" && (url as string).includes("/api/calendar/schedule")
    );
    expect(calendarCalls.length).toBeGreaterThanOrEqual(1);
    expect(calendarCalls[0][1]?.method).toBe("DELETE");
  });
});

describe("PATCH /api/applications/[id]/decide — validation", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 400 for an invalid decision value", async () => {
    _appData = makeApp();
    const req = makeRequest({ decision: "maybe" });
    const resp = await PATCH(req, PARAMS);
    expect(resp.status).toBe(400);
  });

  it("returns 403 when recruiter does not own the job", async () => {
    _appData = makeApp();
    mockJobRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ recruiterId: "different-recruiter", title: "X", positionId: "BH-2026-0099" }),
    });

    const req = makeRequest({ decision: "approved" });
    const resp = await PATCH(req, PARAMS);
    expect(resp.status).toBe(403);
  });
});
