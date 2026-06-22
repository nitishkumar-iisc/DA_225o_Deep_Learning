/**
 * SPEC §3.1, §4.1 — Authentication flows
 */
import { test, expect } from "@playwright/test";
import { loginAs, logout, RECRUITER, CANDIDATE } from "./helpers";

test.describe("Auth — SPEC §3.1 / §4.1", () => {
  test("landing page renders with Sign in and Get started links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('header a[href="/login"]')).toBeVisible();
    await expect(page.locator('header a[href="/login?tab=signup"]')).toBeVisible();
  });

  test("auth page shows Sign in / Get started tab switcher", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
  });

  test("failed login shows inline error, no redirect", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "badpassword");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    expect(page.url()).toContain("/login");
  });

  test("recruiter login redirects to /recruiter/dashboard", async ({ page }) => {
    await loginAs(page, RECRUITER);
    expect(page.url()).toContain("/recruiter/dashboard");
    await logout(page);
  });

  test("candidate login redirects to /candidate/dashboard", async ({ page }) => {
    await loginAs(page, CANDIDATE);
    expect(page.url()).toContain("/candidate/dashboard");
    await logout(page);
  });

  test("unauthenticated access to /recruiter/dashboard redirects to /login", async ({ page }) => {
    await page.goto("/recruiter/dashboard");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to /candidate/dashboard redirects to /login", async ({ page }) => {
    await page.goto("/candidate/dashboard");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("candidate cannot access recruiter routes — gets /unauthorized or /login", async ({ page }) => {
    await loginAs(page, CANDIDATE);
    await page.goto("/recruiter/dashboard");
    await page.waitForURL(/\/(unauthorized|login)/, { timeout: 8_000 });
    await logout(page);
  });

  test("/register redirects to /login?tab=signup", async ({ page }) => {
    await page.goto("/register");
    await page.waitForURL(/\/login.*tab=signup/, { timeout: 8_000 });
    expect(page.url()).toContain("tab=signup");
  });

  test("sign-up tab shows role picker with Candidate and Recruiter options", async ({ page }) => {
    await page.goto("/login?tab=signup");
    await expect(page.getByRole("button", { name: /candidate/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /recruiter/i }).first()).toBeVisible();
  });

  test("nav shows correct links and role badge after login", async ({ page }) => {
    await loginAs(page, RECRUITER);
    await expect(page.getByText(/recruiter/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /jobs/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /applications/i })).toBeVisible();
    await logout(page);
  });
});
