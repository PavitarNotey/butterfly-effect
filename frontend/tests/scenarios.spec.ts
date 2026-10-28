import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { chooseMoment } from "./moment-picker";
import { viewPlayerPov } from "./player-picker";

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

test("switches safely during playback and evidence loading; both complete with their own outcome", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/studio");
  await expect(page.getByTestId("scene-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .locator("canvas")
    .evaluate((el) => (el.dataset.lifecycle = "retained"));
  const slider = page.getByRole("slider", { name: "Replay timeline" });
  await page.route("**/the-invisible-run/evidence", async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ response }).catch(() => {}); // The previous request is legitimately aborted on switch.
  });
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(0.3);
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("the-missed-chance");
  await expect(slider).toHaveValue("0");
  await expect(page.getByTestId("selected-name")).toHaveCount(0);
  await expect(page.getByTestId("match-clock")).toHaveText("61:07");
  await expect(page.getByTestId("score")).toHaveText("0 – 0");
  await expect(
    page.getByRole("button", { name: "Broadcast", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Analyze this moment" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toHaveText(
    "The Run and the Cover",
  );
  await page
    .getByRole("button", { name: "Analytical moment", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Choose analytical moment" })
      .locator("[data-moment-option]"),
  ).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("selected-name")).toHaveCount(0);
  await chooseMoment(page, "recovery");
  await expect(page.getByTestId("primary-observation")).toContainText(
    "3.61 m at 5.85 s to 2.06 m at 7.65 s",
  );
  await viewPlayerPov(page, "c5");
  await expect(slider).toHaveValue("5.85");
  await page.getByRole("button", { name: "Tactical", exact: true }).click();
  await expect(slider).toHaveValue("5.85");
  await page.getByRole("button", { name: "Return to replay" }).click();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Pause replay", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(3.8);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await slider.fill("2");
  await expect(slider).toHaveValue("2");
  await page.getByRole("button", { name: "Restart replay" }).click();
  await expect(slider).toHaveValue("0");
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("2");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(slider).toHaveValue("12", { timeout: 14000 });
  await expect(
    page.getByRole("heading", { name: "The Finish", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("score")).toHaveText("0 – 0");
  for (const id of [
    "the-invisible-run",
    "the-missed-chance",
    "the-invisible-run",
  ]) {
    await page
      .getByRole("combobox", { name: "Scenario", exact: true })
      .selectOption(id);
    await expect(slider).toHaveValue("0");
    await expect(page.getByTestId("selected-name")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-lifecycle",
      "retained",
    );
    await page.getByRole("button", { name: "Analyze this moment" }).click();
    await expect(page.getByTestId("tactical-moment-title")).toHaveText(
      id === "the-invisible-run"
        ? "The Run and the Shift"
        : "The Run and the Cover",
    );
  }
  await slider.fill((await slider.getAttribute("max"))!);
  await expect(page.getByTestId("score")).toHaveText("1 – 0");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("captures both authored defensive sequences in broadcast, overhead and cover POV", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/studio");
  await expect(page.getByTestId("scene-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  for (const { id, times, defender } of [
    { id: "the-invisible-run", times: [0, 1, 2.8, 6.8], defender: "d4" },
    { id: "the-missed-chance", times: [0, 1.3, 5.85, 7.65], defender: "c5" },
  ]) {
    await page
      .getByRole("combobox", { name: "Scenario", exact: true })
      .selectOption(id);
    await page.getByRole("button", { name: "Analyze this moment" }).click();
    await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
    for (const layer of [
      "Player movement",
      "Space & coverage",
      "Player relationships",
    ])
      await page.getByRole("checkbox", { name: layer, exact: true }).check();
    for (const t of times) {
      await page
        .getByRole("slider", { name: "Replay timeline" })
        .fill(String(t));
      for (const camera of ["broadcast", "tactical", "defender"]) {
        if (camera === "defender") await viewPlayerPov(page, defender);
        else
          await page
            .getByRole("button", {
              name: camera === "broadcast" ? "Broadcast" : "Tactical",
              exact: true,
            })
            .click();
        await settle(page);
        await expect(
          page.getByRole("slider", { name: "Replay timeline" }),
        ).toHaveValue(String(t));
        await page
          .getByTestId("replay-viewport")
          .screenshot({
            path: `../output/playwright/3a/${id}/${t}-${camera}.png`,
          });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("scenario selector, missed chance and evidence work on mobile without horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.getByTestId("scene-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("the-missed-chance");
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
  await chooseMoment(page, "recovery");
  await viewPlayerPov(page, "c5");
  await settle(page);
  await page
    .getByTestId("replay-viewport")
    .screenshot({ path: "../output/playwright/3a/mobile-cover-pov.png" });
  await page.screenshot({
    path: "../output/playwright/3a/mobile-studio.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
