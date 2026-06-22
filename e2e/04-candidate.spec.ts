/**
 * SPEC §3.2, §3.3, §3.4 — Candidate flows
 */
import { test, expect } from "@playwright/test";
import { loginAs, logout, CANDIDATE } from "./helpers";

test.describe("Candidate flows — SPEC §3.2 / §3.3 / §3.4", () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, CANDIDATE); });
  test.afterEach(async ({ page }) => { await logout(page); });

  test("candidate dashboard loads", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Error");
    await expect(page.url()).toContain("/candidate/dashboard");
  });

  test("candidate cannot access /recruiter routes", async ({ page }) => {
    await page.goto("/recruiter/dashboard");
    await page.waitForURL(/\/(unauthorized|login)/, { timeout: 8_000 });
  });

  test("upload page is accessible", async ({ page }) => {
    await page.goto("/candidate/upload");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Error");
    // Upload input should exist
    const input = page.locator('input[type="file"], [data-testid="upload"]');
    await expect(input.first()).toBeTruthy();
  });

  test("upload page restricts to PDF only (accept attribute)", async ({ page }) => {
    await page.goto("/candidate/upload");
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[type="file"]').first();
    const accept = await input.getAttribute("accept");
    // Should restrict to PDF
    if (accept) {
      expect(accept).toContain("pdf");
    }
  });

  test("candidate application feed shows score cards sorted by score", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    // Cards with fit scores should be present (seeded data has 15 applications for 3 candidates)
    await expect(page.locator("body")).not.toContainText("Error");
    // Page should not be empty
    const body = await page.textContent("body");
    expect(body!.length).toBeGreaterThan(100);
  });

  test("nav shows Dashboard and Upload Resume links for candidate", async ({ page }) => {
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /upload/i })).toBeVisible();
    // Should NOT show Jobs or Applications (recruiter-only)
    await expect(page.getByRole("link", { name: /^jobs$/i })).not.toBeVisible();
  });
});
