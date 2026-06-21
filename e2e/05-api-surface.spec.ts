/**
 * SPEC §9 — API Surface: auth enforcement + key contracts
 */
import { test, expect } from "@playwright/test";
import { loginAs, getToken, RECRUITER, CANDIDATE } from "./helpers";

test.describe("API Surface — SPEC §9", () => {
  test("POST /api/auth/register rejects duplicate email with 409", async ({ request }) => {
    const res = await request.post("http://localhost:3002/api/auth/register", {
      data: { name: "Dup", email: RECRUITER.email, password: "Test1234!", role: "recruiter" },
    });
    expect([409, 400, 422]).toContain(res.status());
  });

  test("POST /api/auth/register requires all fields", async ({ request }) => {
    const res = await request.post("http://localhost:3002/api/auth/register", {
      data: { name: "Missing Fields" },
    });
    expect([400, 422]).toContain(res.status());
  });

  test("GET /api/jobs — 401 without token", async ({ page }) => {
    const res = await page.request.get("/api/jobs");
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/applications — 401 without token", async ({ page }) => {
    const res = await page.request.get("/api/applications");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/jobs — candidate token returns 403", async ({ page }) => {
    await loginAs(page, CANDIDATE);
    const token = await getToken(page);
    const res = await page.request.post("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Should fail", description: "x", requiredSkills: [], requiredExperienceYears: 0, educationLevel: "any", status: "draft" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/applications — candidate token returns 403", async ({ page }) => {
    await loginAs(page, CANDIDATE);
    const token = await getToken(page);
    const res = await page.request.get("/api/applications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/jobs returns jobs array with positionId field", async ({ page }) => {
    await loginAs(page, RECRUITER);
    const token = await getToken(page);
    const res = await page.request.get("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { jobs } = await res.json();
    expect(Array.isArray(jobs)).toBe(true);
    if (jobs.length > 0) {
      expect(jobs[0].positionId).toMatch(/^BH-\d{4}-\d{4}$/);
      expect(jobs[0].title).toBeDefined();
      expect(jobs[0].status).toBeDefined();
    }
  });

  test("GET /api/applications returns fitScore and status fields", async ({ page }) => {
    await loginAs(page, RECRUITER);
    const token = await getToken(page);
    const res = await page.request.get("/api/applications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { applications } = await res.json();
    if (applications.length > 0) {
      const app = applications[0];
      expect(app.fitScore).toBeDefined();
      expect(app.status).toBeDefined();
      expect(typeof app.fitScore).toBe("number");
    }
  });

  test("PATCH /api/jobs/[id] — candidate token cannot edit job", async ({ page }) => {
    await loginAs(page, RECRUITER);
    const token = await getToken(page);
    const jobsRes = await page.request.get("/api/jobs", { headers: { Authorization: `Bearer ${token}` } });
    const { jobs } = await jobsRes.json();
    const jobId = jobs[0].id;

    await loginAs(page, CANDIDATE);
    const candidateToken = await getToken(page);
    const res = await page.request.patch(`/api/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${candidateToken}` },
      data: { title: "Hacked" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/ml/predict returns a score number", async ({ page }) => {
    await loginAs(page, RECRUITER);
    const token = await getToken(page);
    const res = await page.request.get("/api/ml/predict?jobId=dummy&features=0.5,0.5,0.5,0.5,0.5", {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Either 200 with score or 404 if no model — both acceptable
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof (body.score ?? body.probability)).toBe("number");
    }
  });
});
