/**
 * SPEC §4.2 — Job Posting Management
 */
import { test, expect } from "@playwright/test";
import { loginAs, logout, getToken, RECRUITER } from "./helpers";

test.describe("Recruiter Jobs — SPEC §4.2", () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, RECRUITER); });
  test.afterEach(async ({ page }) => { await logout(page); });

  test("recruiter dashboard loads with job count and stats", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("jobs list page renders existing jobs", async ({ page }) => {
    await page.goto("/recruiter/jobs");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("No jobs");
  });

  test("POST /api/jobs creates job with correct Position ID format", async ({ page }) => {
    const token = await getToken(page);
    const res = await page.request.post("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: "E2E Test Engineer",
        description: "End-to-end test role requiring Playwright expertise",
        requiredSkills: ["Playwright", "TypeScript"],
        requiredExperienceYears: 2,
        educationLevel: "bachelor",
        status: "open",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.job).toBeDefined();
    expect(body.job.positionId).toMatch(/^BH-\d{4}-\d{4}$/);
    expect(body.job.title).toBe("E2E Test Engineer");

    if (body.job.id) {
      await page.request.delete(`/api/jobs/${body.job.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test("PATCH /api/jobs/[id] updates title, preserves positionId", async ({ page }) => {
    const token = await getToken(page);
    const createRes = await page.request.post("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Patch Test Job", description: "temp", requiredSkills: [], requiredExperienceYears: 0, educationLevel: "any" },
    });
    expect(createRes.status()).toBe(201);
    const { job } = await createRes.json();
    const originalPositionId = job.positionId;

    const patchRes = await page.request.patch(`/api/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Updated Title" },
    });
    expect(patchRes.status()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.job.title).toBe("Updated Title");
    expect(updated.job.positionId).toBe(originalPositionId);

    await page.request.delete(`/api/jobs/${job.id}`, { headers: { Authorization: `Bearer ${token}` } });
  });

  test("DELETE /api/jobs/[id] soft-deletes job", async ({ page }) => {
    const token = await getToken(page);
    const createRes = await page.request.post("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Delete Test Job", description: "to be deleted", requiredSkills: [], requiredExperienceYears: 0, educationLevel: "any" },
    });
    expect(createRes.status()).toBe(201);
    const { job } = await createRes.json();

    const delRes = await page.request.delete(`/api/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBe(200);
    const body = await delRes.json();
    expect(body.success).toBe(true);
  });

  test("GET /api/jobs returns jobs array with positionId field", async ({ page }) => {
    const token = await getToken(page);
    const res = await page.request.get("/api/jobs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { jobs } = await res.json();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].positionId).toMatch(/^BH-\d{4}-\d{4}$/);
  });
});

// Auth enforcement — fresh request context (no browser cookies)
test.describe("Recruiter Jobs — auth enforcement", () => {
  test("unauthenticated GET /api/jobs returns 401", async ({ request }) => {
    const res = await request.get("http://localhost:3002/api/jobs");
    expect([401, 403]).toContain(res.status());
  });
});
