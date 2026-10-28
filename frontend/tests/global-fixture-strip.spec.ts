import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { selectPlayer } from "./player-picker";
import { chooseMoment } from "./moment-picker";

const fixture = (page: Page, id: string) =>
  page.getByTestId("global-fixture-strip").locator(`a[href="/matches/${id}"]`);
async function playbackState(page: Page) {
  return page.evaluate(async () => {
    // Vite can retain HMR timestamps even on a fresh page. Import the exact
    // mounted modules; bare paths can create a second, default replay store.
    const entries = performance.getEntriesByType("resource");
    const loaded = (path: string) =>
      entries.find((e) => new URL(e.name).pathname === path)!.name;
    const { replayStore } = await import(loaded("/src/replay/store.ts"));
    const { useTactics } = await import(loaded("/src/tactics/store.ts"));
    const state = replayStore.getState(),
      tactics = useTactics.getState();
    return {
      scenarioId: state.scenario.id,
      time: state.readTime(),
      camera: state.camera,
      selectedId: state.selectedId,
      playing: state.playing,
      speed: state.speed,
      guided: state.guided,
      scrubbing: state.scrubbing,
      trails: state.trails,
      enabled: tactics.enabled,
      bundle: tactics.bundle,
    };
  });
}

const cleanPlayback = {
  time: 0,
  camera: "broadcast",
  selectedId: null,
  playing: false,
  speed: 1,
  guided: null,
  scrubbing: false,
  trails: false,
  enabled: false,
  bundle: null,
};

test("all main routes expose exactly one global strip with real scores, kickoff times and URL-based active state", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/matches/vesper-tidal",
    "/matches/vesper-tidal/moments/vesper-tidal-merrick",
    "/standings",
    "/studio",
    "/fixtures",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("global-fixture-strip")).toHaveCount(1);
    await expect(page.getByTestId("strip-fixture")).toHaveCount(5);
    await expect(
      page.getByRole("link", { name: "Butterfly Effect home", exact: true }),
    ).toHaveCount(1);
    const strip = page.getByTestId("global-fixture-strip");
    await expect(
      strip.locator(".strip-status > span:first-child", { hasText: /^FT$/ }),
    ).toHaveCount(3);
    await expect(fixture(page, "aurora-boreal")).toContainText("AUR");
    await expect(
      fixture(page, "aurora-boreal").locator(".strip-team strong"),
    ).toHaveText(["2", "1"]);
    await expect(
      fixture(page, "solstice-cinder").locator(".strip-team strong"),
    ).toHaveText(["0", "1"]);
    await expect(fixture(page, "ashcombe-redhaven")).toContainText(
      "25 Oct, 14:00 UTC",
    );
    await expect(fixture(page, "kingswell-larkspur")).toContainText(
      "25 Oct, 16:30 UTC",
    );
    await expect(strip.locator('[aria-current="page"]')).toHaveCount(
      path.startsWith("/matches/vesper-tidal") ? 1 : 0,
    );
    if (path.startsWith("/matches/vesper-tidal"))
      await expect(fixture(page, "vesper-tidal")).toHaveAttribute(
        "aria-current",
        "page",
      );
  }
});

test("direct fixture switches unmount playing previews, POV studios, guided analysis and the scenario library", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE|WebGL|shader/i.test(message.text())
    )
      errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/matches/vesper-tidal");
  await expect(page.getByTestId("scene-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const strip = await page.getByTestId("global-fixture-strip").elementHandle();
  const preview = await page.locator("canvas").elementHandle();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Play preview", exact: true }).click();
  await expect
    .poll(async () =>
      parseFloat(await page.getByTestId("preview-time").innerText()),
    )
    .toBeGreaterThan(0.2);
  await fixture(page, "aurora-boreal").click();
  await expect(page.getByTestId("match-viewer")).toHaveAttribute(
    "data-scenario",
    "the-invisible-run",
  );
  await expect
    .poll(() => playbackState(page))
    .toMatchObject({ ...cleanPlayback, scenarioId: "the-invisible-run" });
  expect(await preview!.evaluate((element) => element.isConnected)).toBe(false);
  await expect
    .poll(() =>
      preview!.evaluate((element) =>
        (element as HTMLCanvasElement).getContext("webgl2")?.isContextLost(),
      ),
    )
    .toBe(true);
  expect(await strip!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(1);

  await page
    .getByRole("link", { name: "Open full analysis", exact: true })
    .click();
  await selectPlayer(page, "a9");
  await page
    .getByRole("button", { name: "View Leon Voss's POV", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("2");
  await page.getByRole("checkbox", { name: "Movement trail" }).check();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  const studio = await page.locator("canvas").elementHandle();
  await fixture(page, "vesper-tidal").click();
  await expect(page.getByTestId("match-viewer")).toHaveAttribute(
    "data-scenario",
    "the-untouched-pass",
  );
  await expect
    .poll(() => playbackState(page))
    .toMatchObject({ ...cleanPlayback, scenarioId: "the-untouched-pass" });
  expect(await studio!.evaluate((element) => element.isConnected)).toBe(false);
  await expect
    .poll(() =>
      studio!.evaluate((element) =>
        (element as HTMLCanvasElement).getContext("webgl2")?.isContextLost(),
      ),
    )
    .toBe(true);

  await page
    .getByRole("link", { name: "Open full analysis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Analyze this moment", exact: true })
    .click();
  await page.getByTestId("tactical-moment-title").waitFor();
  await chooseMoment(page, "dummy");
  await page
    .getByRole("button", { name: "Show me in the replay", exact: true })
    .click();
  await expect(page.getByTestId("guided-replay")).toBeVisible();
  await fixture(page, "solstice-cinder").click();
  await expect(page.getByTestId("match-viewer")).toHaveAttribute(
    "data-scenario",
    "the-missed-chance",
  );
  await expect
    .poll(() => playbackState(page))
    .toMatchObject({ ...cleanPlayback, scenarioId: "the-missed-chance" });
  await expect(page.getByTestId("guided-replay")).toHaveCount(0);

  await fixture(page, "ashcombe-redhaven").click();
  await expect(page.getByTestId("match-final-score")).toHaveText("VS");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect.poll(() => playbackState(page)).toMatchObject(cleanPlayback);
  await expect(fixture(page, "ashcombe-redhaven")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goBack();
  await expect(fixture(page, "solstice-cinder")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goForward();
  await expect(fixture(page, "ashcombe-redhaven")).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page
    .getByRole("link", { name: "Scenario library ↗", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Invisible Run." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await fixture(page, "kingswell-larkspur").click();
  await expect(page.getByTestId("match-final-score")).toHaveText("VS");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect.poll(() => playbackState(page)).toMatchObject(cleanPlayback);
  expect(await strip!.evaluate((element) => element.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});

for (const width of [1440, 1024, 390]) {
  test(`sticky navigation, horizontal access, focus and scroll offsets work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/matches/kingswell-larkspur");
    await expect(page.getByTestId("strip-fixture")).toHaveCount(5);
    await expect(
      page
        .getByRole("heading", { name: "Kingswell Town", exact: true })
        .first(),
    ).toBeVisible();
    const rail = page.locator(".fixture-scroll");
    const current = fixture(page, "kingswell-larkspur");
    await expect
      .poll(async () => {
        const card = (await current.boundingBox())!,
          bounds = (await rail.boundingBox())!;
        return (
          card.x >= bounds.x - 1 &&
          card.x + card.width <= bounds.x + bounds.width + 1
        );
      })
      .toBe(true);
    if (width === 1440)
      expect(
        await rail.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    else
      expect(
        await rail.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true);
    const chrome = page.getByTestId("site-chrome");
    const content = (await page.locator("#page-main").boundingBox())!,
      initial = (await chrome.boundingBox())!;
    expect(content.y).toBeGreaterThanOrEqual(initial.y + initial.height - 1);

    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Standings", exact: true })
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.evaluate(() =>
      window.scrollTo({ top: 700, behavior: "instant" }),
    );
    const headerBox = (await page.locator(".site-header").boundingBox())!,
      stripBox = (await page
        .getByTestId("global-fixture-strip")
        .boundingBox())!;
    expect(headerBox.y).toBeCloseTo(0, 0);
    expect(stripBox.y).toBeCloseTo(headerBox.y + headerBox.height, 0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../output/global-fixture-strip/standings-scrolled-${width}.png`,
    });

    const target = fixture(page, "aurora-boreal");
    await target.focus();
    await page.keyboard.press("Tab");
    await expect(fixture(page, "vesper-tidal")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/matches/vesper-tidal");
    await expect(fixture(page, "vesper-tidal")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const slider = page.getByRole("slider", {
      name: "Replay timeline",
      exact: true,
    });
    await slider.scrollIntoViewIfNeeded();
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("0.01");
    const controlBox = (await slider.boundingBox())!,
      chromeBox = (await chrome.boundingBox())!;
    expect(controlBox.y).toBeGreaterThanOrEqual(
      chromeBox.y + chromeBox.height - 1,
    );
    await page.screenshot({
      path: `../output/global-fixture-strip/match-controls-${width}.png`,
    });
  });
}

test("the scenario library remains usable offline and recovering navigation preserves its canvas and clock", async ({
  page,
}) => {
  await page.route("**/api/league", (route) => route.abort());
  await page.goto("/studio");
  await expect(
    page.getByRole("heading", { name: "The Invisible Run." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Match navigation" })
      .getByRole("alert"),
  ).toContainText("unavailable");
  await page.getByRole("slider", { name: "Replay timeline" }).fill("4");
  const canvas = await page.locator("canvas").elementHandle();
  await page.unroute("**/api/league");
  await page.getByRole("button", { name: "Retry match navigation" }).click();
  await expect(page.getByTestId("strip-fixture")).toHaveCount(5);
  await expect(page.getByTestId("replay-time")).toContainText("4.0");
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
});

test("fixture failures are retryable and standings failures do not disable global navigation", async ({
  page,
}) => {
  await page.route("**/api/fixtures", (route) => route.abort());
  await page.route("**/api/standings", (route) => route.abort());
  await page.goto("/matches/vesper-tidal");
  await expect(page.getByTestId("match-final-score")).toHaveText("2 – 1");
  await expect(
    page
      .getByRole("navigation", { name: "Match navigation" })
      .getByRole("alert"),
  ).toContainText("unavailable");
  await page.unroute("**/api/fixtures");
  await page.getByRole("button", { name: "Retry match navigation" }).click();
  await expect(page.getByTestId("strip-fixture")).toHaveCount(5);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Standings", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("strip-fixture")).toHaveCount(5);
  await fixture(page, "aurora-boreal").click();
  await expect(page.getByTestId("match-final-score")).toHaveText("2 – 1");
  await expect(page.getByTestId("match-viewer")).toHaveAttribute(
    "data-scenario",
    "the-invisible-run",
  );
});
