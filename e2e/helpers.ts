import { Page } from "@playwright/test";

export const BASE = "http://localhost:3002";

export const RECRUITER = { email: "recruiter1@besthire.dev", password: "Test1234!" };
export const RECRUITER2 = { email: "recruiter2@besthire.dev", password: "Test1234!" };
export const CANDIDATE = { email: "alice@candidate.dev", password: "Test1234!" };
export const CANDIDATE2 = { email: "bob@candidate.dev", password: "Test1234!" };

export async function loginAs(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(recruiter|candidate)\/dashboard/, { timeout: 15_000 });
}

export async function logout(page: Page) {
  const btn = page.getByRole("button", { name: /sign out/i });
  if (await btn.isVisible()) await btn.click();
  await page.waitForURL("/login", { timeout: 8_000 });
}

export async function getToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const match = document.cookie.match(/token=([^;]+)/);
    return match ? match[1] : "";
  });
}
