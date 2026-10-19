import { expect, test } from "@playwright/test";

test.describe("dashboard (mock data)", () => {
  test("shows KPIs, charts and the outstanding table", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Zoho Dashboard/ })).toBeVisible();
    await expect(page.getByTestId("mode-badge")).toHaveText("Sample data");

    for (const id of ["pipeline", "won", "winrate", "invoiced", "outstanding", "overdue"]) {
      await expect(page.getByTestId(`kpi-${id}`).locator(".value")).toHaveText(/^(\$[\d,]+|\d+%|—)$/);
    }
    for (const id of ["chart-monthly", "chart-pipeline", "chart-aging"]) {
      const canvas = page.getByTestId(id).locator("canvas");
      await expect(canvas).toBeVisible();
      expect((await canvas.boundingBox())!.height).toBeGreaterThan(200);
    }
    await expect(page.getByTestId("table-outstanding").locator("tbody tr")).toHaveCount(10);
  });

  test("changing the range refetches with new dates", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("chart-monthly").locator("canvas")).toBeVisible();

    const req = page.waitForRequest((r) => r.url().includes("/api/dashboard"));
    await page.getByLabel("Range").selectOption("3m");
    const url = new URL((await req).url());
    const days = (Date.parse(url.searchParams.get("to")!) - Date.parse(url.searchParams.get("from")!)) / 86_400_000;
    expect(days).toBeGreaterThan(85);
    expect(days).toBeLessThan(95);

    await page.getByTestId("chart-monthly").getByText("Show table").click();
    await expect(page.getByTestId("chart-monthly").locator("tbody tr")).toHaveCount(4);
  });

  test("custom range shows date inputs", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Range").selectOption("custom");
    await expect(page.getByLabel("From")).toBeVisible();
    await expect(page.getByLabel("To")).toBeVisible();
  });

  test("shows an error banner when the API fails", async ({ page }) => {
    await page.route("**/api/dashboard*", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Zoho is down" }) }),
    );
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("Zoho is down");
  });

  test("has no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("chart-monthly").locator("canvas")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("API tester", () => {
  test("loads presets and explains that live mode is needed", async ({ page }) => {
    await page.goto("/api-tester.html");
    await expect(page.getByRole("heading", { name: /Zoho API Tester/ })).toBeVisible();

    await page.getByRole("button", { name: "Books: 5 invoices" }).click();
    await expect(page.getByLabel("Path")).toHaveValue("/books/v3/invoices");

    await page.getByRole("button", { name: "Send GET" }).click();
    await expect(page.getByRole("alert")).toContainText("DATA_MODE=live");
  });

  test("renders a response from the server", async ({ page }) => {
    await page.route("**/api/zoho", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://www.zohoapis.com/crm/v7/users?type=CurrentUser",
          status: 200,
          durationMs: 42,
          body: { users: [{ full_name: "Test User" }] },
        }),
      }),
    );
    await page.goto("/api-tester.html");
    await page.getByRole("button", { name: "Send GET" }).click();
    const result = page.getByTestId("probe-result");
    await expect(result).toContainText("HTTP 200");
    await expect(result).toContainText("Test User");
  });
});
