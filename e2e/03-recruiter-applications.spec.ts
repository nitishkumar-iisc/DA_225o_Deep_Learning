/**
 * SPEC §4.3 — Application Review (approve / reject / undo)
 */
import { test, expect } from "@playwright/test";
import { loginAs, logout, getToken, RECRUITER } from "./helpers";

test.describe("Recruiter Applications — SPEC §4.3", () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, RECRUITER); });
  test.afterEach(async ({ page }) => { await logout(page); });

  test("applications list page loads and shows table", async ({ page }) => {
    await page.goto("/recruiter/applications");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Error");
    const rows = page.locator("tbody tr, [data-testid='app-row']");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("GET /api/applications returns applications for recruiter", async ({ page }) => {
    const token = await getToken(page);
    const res = await page.request.get("/api/applications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { applications } = await res.json();
    expect(Array.isArray(applications)).toBe(true);
    expect(applications.length).toBeGreaterThan(0);
  });

  test("GET /api/applications filters by status=pending", async ({ page }) => {
    const token = await getToken(page);
    const res = await page.request.get("/api/applications?status=pending", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { applications } = await res.json();
    applications.forEach((a: { status: string }) => {
      expect(a.status).toBe("pending");
    });
  });

  test("GET /api/applications filters by jobId", async ({ page }) => {
    const token = await getToken(page);
    const jobsRes = await page.request.get("/api/jobs", { headers: { Authorization: `Bearer ${token}` } });
    const { jobs } = await jobsRes.json();
    const jobId = jobs[0].id;

    const res = await page.request.get(`/api/applications?jobId=${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const { applications } = await res.json();
    applications.forEach((a: { jobId: string }) => {
      expect(a.jobId).toBe(jobId);
    });
  });

  test("GET /api/applications/[id] returns full application detail", async ({ page }) => {
    const token = await getToken(page);
    const listRes = await page.request.get("/api/applications", { headers: { Authorization: `Bearer ${token}` } });
    const { applications } = await listRes.json();
    const appId = applications[0].id;

    const res = await page.request.get(`/api/applications/${appId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.application).toBeDefined();
    expect(body.candidate).toBeDefined();
    expect(body.job).toBeDefined();
  });

  test("PATCH /api/applications/[id]/decide — approve sets decision=approved", async ({ page }) => {
    const token = await getToken(page);
    const listRes = await page.request.get("/api/applications?status=pending", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { applications } = await listRes.json();
    if (applications.length === 0) test.skip();
    const appId = applications[0].id;

    const res = await page.request.patch(`/api/applications/${appId}/decide`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { decision: "approved" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // API returns { success, decision, decidedAt }
    expect(body.decision ?? body.application?.decision).toBe("approved");

    // Undo
    await page.request.patch(`/api/applications/${appId}/decide`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { decision: null },
    });
  });

  test("PATCH /api/applications/[id]/decide — reject sets decision=rejected", async ({ page }) => {
    const token = await getToken(page);
    const listRes = await page.request.get("/api/applications?status=pending", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { applications } = await listRes.json();
    if (applications.length === 0) test.skip();
    const appId = applications[applications.length > 1 ? 1 : 0].id;

    const res = await page.request.patch(`/api/applications/${appId}/decide`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { decision: "rejected" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.decision ?? body.application?.decision).toBe("rejected");

    // Undo
    await page.request.patch(`/api/applications/${appId}/decide`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { decision: null },
    });
  });
});

// Unauthenticated tests use a fresh context — no browser cookies
test.describe("Recruiter Applications — auth enforcement", () => {
  test("unauthenticated GET /api/applications returns 401", async ({ request }) => {
    const res = await request.get("http://localhost:3002/api/applications");
    expect([401, 403]).toContain(res.status());
  });
});
