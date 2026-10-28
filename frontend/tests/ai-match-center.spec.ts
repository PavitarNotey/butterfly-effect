import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const matchPath = "/matches/vesper-tidal";
const recapPattern = "**/api/ai/matches/vesper-tidal/recap?*";

test.beforeEach(async ({ page, request }) => {
  expect(
    (await (await request.get("http://127.0.0.1:8001/api/ai/status")).json())
      .provider,
  ).toBe("mock");
  await page.route("**/api/ai/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:8001${url.pathname}${url.search}`,
    });
    await route.fulfill({ response });
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function frameExperience(page: Page) {
  await page.evaluate(() => {
    const section = document.querySelector(".match-experience")!;
    const chrome = document.querySelector(".site-chrome")!;
    window.scrollTo({
      top:
        section.getBoundingClientRect().top +
        scrollY -
        chrome.getBoundingClientRect().height -
        16,
      behavior: "instant",
    });
  });
}

for (const width of [1440, 1024, 390]) {
  test(`AI is immediately discoverable with a usable replay at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let generations = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/ai/matches/") && r.url().includes("/recap"))
        generations++;
    });
    await page.goto(matchPath);
    const panel = page.getByTestId("match-intelligence");
    await expect(panel).toHaveAttribute("data-state", "idle");
    await expect(
      panel.getByRole("button", { name: "Analyze this moment" }),
    ).toBeVisible();
    await expect(panel).toContainText("Authored demo");
    const ai = await panel.boundingBox(),
      replay = await page.getByTestId("match-viewer").boundingBox();
    expect(ai).not.toBeNull();
    expect(replay).not.toBeNull();
    if (width === 1440) {
      const layout = await page.getByTestId("match-experience").boundingBox();
      expect(ai!.width / layout!.width).toBeGreaterThan(0.3);
      expect(ai!.width / layout!.width).toBeLessThan(0.34);
      expect(ai!.x + ai!.width).toBeLessThan(replay!.x);
      expect(replay!.width).toBeGreaterThan(620);
      expect(
        await page
          .locator(".match-ai-column")
          .evaluate((e) => getComputedStyle(e).position),
      ).toBe("sticky");
    } else {
      expect(ai!.y + ai!.height).toBeLessThan(replay!.y);
      expect(replay!.width).toBeGreaterThan(width === 390 ? 340 : 900);
      expect(
        await page
          .locator(".match-ai-column")
          .evaluate((e) => getComputedStyle(e).position),
      ).toBe("static");
    }
    expect(generations).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await frameExperience(page);
    await page.screenshot({
      path: `../output/playwright/phase4-1/idle-${width}.png`,
    });
    if (width !== 1440) {
      await panel
        .getByRole("button", { name: "Collapse AI intelligence" })
        .click();
      await expect(
        panel.getByRole("button", { name: "Analyze this moment" }),
      ).not.toBeVisible();
      await panel
        .getByRole("button", { name: "Expand AI intelligence" })
        .focus();
      await page.keyboard.press("Enter");
      await expect(
        panel.getByRole("button", { name: "Analyze this moment" }),
      ).toBeVisible();
    }
  });
}

test("real response completion controls the reveal; a failed refresh retains successful content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = false;
  await page.route(recapPattern, async (route) => {
    if (fail) {
      await route.fulfill({
        status: 503,
        json: { detail: "private diagnostic body" },
      });
      return;
    }
    await gate;
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:8001${url.pathname}${url.search}`,
    });
    const data = await response.json();
    await route.fulfill({ json: { ...data, cached: false } });
  });
  await page.goto(matchPath);
  const panel = page.getByTestId("match-intelligence");
  await panel.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(panel).toHaveAttribute("data-state", "loading");
  await expect(panel.getByRole("status").first()).toContainText(
    "Preparing your football analysis",
  );
  await expect(panel.locator(".ai-headline")).toHaveCount(0);
  await expect(panel.locator(".ai-sweep")).toHaveCSS(
    "animation-iteration-count",
    "2",
  );
  release();
  await expect(panel).toHaveAttribute("data-state", "ready");
  await expect(panel.locator(".ai-headline")).toHaveText(
    "The pass that stayed untouched",
  );
  await expect(panel.locator(".ai-headline")).toHaveCSS(
    "animation-name",
    "ai-headline-in",
  );
  await expect(panel.locator(".ai-takeaway")).toHaveCSS("opacity", "1");
  await expect(panel.locator(".ai-sweep")).toHaveCount(0);
  await panel
    .locator(".ai-headline")
    .evaluate((e) => e.setAttribute("data-preserved", "true"));
  fail = true;
  await panel.getByRole("button", { name: "Check saved analysis" }).click();
  await expect(panel).toHaveAttribute("data-state", "error");
  await expect(panel.getByRole("alert")).toContainText(
    "previous analysis is still here",
  );
  await expect(panel).not.toContainText("private diagnostic body");
  await expect(panel.locator(".ai-headline")).toHaveAttribute(
    "data-preserved",
    "true",
  );
  fail = false;
  await panel.getByRole("button", { name: "Retry analysis" }).click();
  await expect(panel).toHaveAttribute("data-state", "ready");
  await expect(panel.locator(".ai-takeaway")).toHaveCSS("opacity", "1");
  await frameExperience(page);
  await page.screenshot({
    path: "../output/playwright/phase4-1/desktop-ready.png",
  });
  await page.unrouteAll({ behavior: "wait" });
});

test("mode and match switches cancel stale content and its reveal", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(recapPattern, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("cache_only") === "true") {
      await route.fulfill({
        status: 409,
        json: { detail: "No saved analysis." },
      });
      return;
    }
    if (url.searchParams.get("mode") === "casual") await gate;
    const response = await route.fetch({
      url: `http://127.0.0.1:8001${url.pathname}${url.search}`,
    });
    const data = await response.json();
    data.narratives[0].headline =
      url.searchParams.get("mode") === "casual"
        ? "Delayed casual result"
        : "Current analyst result";
    await route.fulfill({ json: data });
  });
  await page.goto(matchPath);
  const panel = page.getByTestId("match-intelligence");
  await panel.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(panel).toHaveAttribute("data-state", "loading");
  await panel.getByRole("button", { name: "Analyst", exact: true }).click();
  await expect(panel.getByText(/No saved analysis in this mode/)).toBeVisible();
  await panel.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(panel.locator(".ai-headline")).toHaveText(
    "Current analyst result",
  );
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(panel.locator(".ai-headline")).toHaveText(
    "Current analyst result",
  );
  await expect(panel).not.toContainText("Delayed casual result");
  await page.getByTestId("strip-fixture").filter({ hasText: "AUR" }).click();
  await expect(page.getByTestId("match-intelligence")).toHaveAttribute(
    "data-state",
    "idle",
  );
  await expect(page.locator(".ai-ready-reveal")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.effect instanceof KeyframeEffect &&
              (a.effect.target as Element)?.closest(".ai-ready-reveal"),
          ).length,
    ),
  ).toBe(0);
});

for (const provider of ["foundry", "validation_fallback"] as const) {
  test(`${provider} has honest provenance, human evidence and no developer diagnostics`, async ({
    page,
    request,
  }) => {
    const fixture = await (
      await request.get(
        "http://127.0.0.1:8001/api/ai/matches/vesper-tidal/recap?mode=analyst",
      )
    ).json();
    fixture.provider = provider;
    fixture.cached = true;
    await page.route(recapPattern, (route) => route.fulfill({ json: fixture }));
    await page.goto(matchPath);
    const panel = page.getByTestId("match-intelligence");
    await panel.getByRole("button", { name: "Analyst", exact: true }).click();
    await panel.getByRole("button", { name: "Analyze this moment" }).click();
    await expect(panel).toHaveAttribute(
      "data-state",
      provider === "foundry" ? "ready" : "fallback",
    );
    await expect(panel.locator(".ai-provenance")).toContainText(
      provider === "foundry" ? "AI-generated" : "Authored fallback",
    );
    await expect(panel.locator(".ai-provenance")).toContainText("Cached");
    await expect(panel.locator(".ai-headline")).toHaveCSS(
      "animation-duration",
      "0.18s",
    );
    await expect(panel.locator(".ai-evidence")).not.toHaveAttribute("open");
    await expect(
      panel.getByText("Measured replay detail", { exact: true }).first(),
    ).not.toBeVisible();
    await panel.getByText("Explore the evidence", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      panel.getByText("Measured replay detail", { exact: true }).first(),
    ).toBeVisible();
    const text = await panel.innerText();
    expect(text).not.toMatch(
      /match:vesper-tidal|the-untouched-pass:v1|confidence_label|claim screening|Why this explanation|Recorded result & key events/,
    );
    expect(text).not.toContain("Final score");
    await expect(
      panel.getByRole("link", { name: "Open Replay Studio" }),
    ).toHaveAttribute(
      "href",
      "/matches/vesper-tidal/moments/vesper-tidal-merrick",
    );
  });
}

test("reduced-motion mobile ready state has no sweep or reveal animation and preserves replay controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(matchPath);
  const panel = page.getByTestId("match-intelligence");
  await panel.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(panel).toHaveAttribute("data-state", "ready");
  await expect(panel.locator(".ai-headline")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(panel.locator(".ai-sentence").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(panel.locator(".ai-takeaway")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../output/playwright/phase4-1/mobile-ready.png",
  });
  await panel.getByRole("button", { name: "Collapse AI intelligence" }).click();
  await page.getByRole("button", { name: "Play preview" }).click();
  await expect
    .poll(async () =>
      parseFloat(await page.getByTestId("preview-time").innerText()),
    )
    .toBeGreaterThan(0.3);
  await page.getByRole("button", { name: "Pause preview" }).click();
});
