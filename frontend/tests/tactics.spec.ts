import { expect, test } from "@playwright/test";
import { viewPlayerPov } from "./player-picker";
import type { EvidenceBundle } from "../src/tactics/types";

async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

test("real evidence, overlays, moments, clock and cameras stay synchronized", async ({
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
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toHaveText(
    "The Run and the Shift",
  );
  await expect(page.getByTestId("corridor-state")).toContainText("obstructed");
  await settle(page);
  expect(before.equals(await canvas.screenshot())).toBe(false);
  await page
    .getByTestId("replay-viewport")
    .screenshot({
      path: "../output/playwright/tactics/00-initial-corridor.png",
    });
  await page
    .getByRole("checkbox", { name: "Player movement", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Space & coverage", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Player relationships", exact: true })
    .check();
  await page
    .getByRole("region", { name: "Tactical analysis" })
    .getByRole("button", { name: /The Run and the Shift/ })
    .click();
  await page.getByRole("slider", { name: "Replay timeline" }).fill("2.8");
  await expect(page.getByTestId("replay-time")).toContainText("2.8");
  await page.getByRole("button", { name: "Tactical", exact: true }).click();
  await settle(page);
  await expect(canvas).toHaveAttribute(
    "data-tactical-layers",
    "passing,movement,space,relationships",
  );
  await page
    .getByTestId("replay-viewport")
    .screenshot({
      path: "../output/playwright/tactics/06-reshaping-overhead.png",
    });
  await viewPlayerPov(page, "d4");
  await expect(page.getByTestId("replay-time")).toContainText("2.8");
  await settle(page);
  await page
    .getByTestId("replay-viewport")
    .screenshot({ path: "../output/playwright/tactics/06-mercer-pov.png" });
  await page
    .getByRole("region", { name: "Tactical analysis" })
    .getByRole("button", { name: /The Passing Window/ })
    .click();
  await expect(page.getByTestId("primary-observation")).toContainText("2.04 m");
  await expect(page.getByTestId("corridor-state")).toContainText(
    "clear under geometric thresholds",
  );
  await page.getByRole("button", { name: "Broadcast", exact: true }).click();
  await settle(page);
  await page.screenshot({
    path: "../output/playwright/tactics/09-pass-studio.png",
    fullPage: true,
  });
  await page
    .getByRole("checkbox", { name: "Passing lanes", exact: true })
    .uncheck();
  await settle(page);
  await expect(canvas).toHaveAttribute(
    "data-tactical-layers",
    "movement,space,relationships",
  );
  const slider = page.getByRole("slider", { name: "Replay timeline" });
  await slider.fill("5");
  await settle(page);
  await page
    .getByTestId("replay-viewport")
    .screenshot({ path: "../output/playwright/tactics/05-diagonal-run.png" });
  await slider.fill("1");
  await expect(page.getByTestId("tactical-moment-title")).toHaveText(
    "The Run and the Shift",
  );
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("2");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(1.5);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const t = await slider.inputValue();
  await page.getByRole("button", { name: "Return to replay" }).click();
  await expect(canvas).toHaveAttribute("data-tactical-layers", "");
  expect(await slider.inputValue()).toBe(t);
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
  await page
    .getByRole("region", { name: "Tactical analysis" })
    .getByRole("button", { name: /The Finish/ })
    .click();
  await page
    .getByRole("checkbox", { name: "Passing lanes", exact: true })
    .check();
  await page.getByRole("button", { name: "Tactical", exact: true }).click();
  await settle(page);
  await page
    .getByTestId("replay-viewport")
    .screenshot({ path: "../output/playwright/tactics/14-finish.png" });
  expect(await page.locator("canvas").count()).toBe(1);
  expect(errors).toEqual([]);
});

test("compact analytical moment picker supports keyboard selection, dismissal and unclipped placement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/studio");
  await expect(page.getByTestId("scene-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
  const trigger = page.getByRole("button", {
    name: "Analytical moment",
    exact: true,
  });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Choose analytical moment" });
  await expect(menu.locator("[data-moment-option]")).toHaveCount(4);
  await expect(menu.locator('[data-moment-id="run"]')).toBeFocused();
  expect(
    await menu.evaluate((element) => element.parentElement === document.body),
  ).toBe(true);
  await page.screenshot({
    path: "../output/playwright/tactics/moment-picker-desktop.png",
  });
  await page.keyboard.press("ArrowDown");
  await expect(menu.locator('[data-moment-id="pass"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("slider", { name: "Replay timeline" }),
  ).toHaveValue("4.4");
  await expect(page.getByTestId("tactical-moment-title")).toHaveText(
    "The Passing Window",
  );
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator(".hud-title").click();
  await expect(menu).toHaveCount(0);
});

test("analytical moment picker fits the mobile viewport and accepts touch selection", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/studio");
  await expect(page.getByTestId("scene-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("combobox", { name: "Scenario", exact: true })
    .selectOption("the-missed-chance");
  await page.getByRole("button", { name: "Analyze this moment" }).tap();
  await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
  await page
    .getByRole("button", { name: "Analytical moment", exact: true })
    .tap();
  const menu = page.getByRole("dialog", { name: "Choose analytical moment" });
  await expect(menu.locator("[data-moment-option]")).toHaveCount(4);
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: "../output/playwright/tactics/moment-picker-mobile.png",
  });
  await menu.locator('[data-moment-id="recovery"]').tap();
  await expect(menu).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: "Replay timeline" }),
  ).toHaveValue("5.85");
  await context.close();
});

test("evidence request failure and source mismatch are explicit and replay survives", async ({
  page,
}) => {
  await page.route("**/api/scenarios/*/evidence", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/studio");
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByRole("alert")).toContainText("503");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect
    .poll(async () =>
      parseFloat(await page.getByTestId("replay-time").innerText()),
    )
    .toBeGreaterThan(0.4);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await page.unroute("**/api/scenarios/*/evidence");
  await page.route("**/api/scenarios/*/evidence", async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    body.sourceHash = "stale";
    await route.fulfill({ response, json: body });
  });
  await page.getByRole("button", { name: "Retry evidence" }).click();
  await expect(page.getByRole("alert")).toContainText("does not match");
  await page.unroute("**/api/scenarios/*/evidence");
  await page.getByRole("button", { name: "Retry evidence" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
});

const malformedEvidence: [string, (bundle: EvidenceBundle) => void][] = [
  [
    "nearest defender",
    (bundle) => {
      bundle.frames[0].space.nearestDefenderId = "missing-player";
    },
  ],
  [
    "relationship order",
    (bundle) => {
      bundle.frames[1].relationships.reverse();
    },
  ],
  [
    "shot coordinate",
    (bundle) => {
      bundle.shotPath[0].position[0] = null as never;
    },
  ],
  [
    "chain reference",
    (bundle) => {
      bundle.chain[0].toMomentId = "missing-moment";
    },
  ],
];
for (const [name, corrupt] of malformedEvidence) {
  test(`malformed ${name} is rejected before rendering, ordinary replay survives, and retry recovers`, async ({
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
    await page.route("**/api/scenarios/*/evidence", async (route) => {
      const response = await route.fetch(),
        bundle: EvidenceBundle = await response.json();
      corrupt(bundle); // Keep the genuine matching source hash: structure must still be validated.
      await route.fulfill({ response, json: bundle });
    });
    await page.goto("/studio");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-character-renderer",
      "skeletal",
    );
    await page
      .getByRole("button", { name: "Analyze this moment", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Replay remains available.",
    );
    await expect(page.getByTestId("tactical-moment-title")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-tactical-layers",
      "",
    );
    const timeline = page.getByRole("slider", { name: "Replay timeline" });
    await timeline.fill("2");
    await page
      .getByRole("button", { name: "Play replay", exact: true })
      .click();
    await expect
      .poll(async () => Number(await timeline.inputValue()))
      .toBeGreaterThan(2.2);
    await page
      .getByRole("button", { name: "Pause replay", exact: true })
      .click();
    await page.unroute("**/api/scenarios/*/evidence");
    await page
      .getByRole("button", { name: "Retry evidence", exact: true })
      .click();
    await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
    await page
      .getByRole("button", { name: "Show me in the replay", exact: true })
      .click();
    await expect(page.getByTestId("guided-replay")).toHaveAttribute(
      "data-status",
      "playing",
    );
    await expect(page.locator("canvas")).not.toHaveAttribute(
      "data-guided-evidence",
      "",
    );
    await page
      .getByRole("button", { name: "Close guided replay", exact: true })
      .click();
    expect(errors).toEqual([]);
  });
}

for (const [id, headline, happened] of [
  [
    "the-invisible-run",
    "Rowan runs wide as the defence shifts",
    "Rowan runs diagonally toward the wide channel as nearby defenders adjust their positions.",
  ],
  [
    "the-missed-chance",
    "The wide run meets a dropping defence",
    "Quinn runs outside. Rook drops with the run while Ward remains near the central channel.",
  ],
] as const) {
  test(`${id} retains editorial copy and all five guided evidence categories`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/studio");
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-character-renderer",
      "skeletal",
    );
    await page
      .getByRole("combobox", { name: "Scenario", exact: true })
      .selectOption(id);
    await page
      .getByRole("button", { name: "Analyze this moment", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "Tactical analysis" });
    const bundle: EvidenceBundle = await (
      await page.request.get(
        `http://127.0.0.1:8000/api/scenarios/${id}/evidence`,
      )
    ).json();
    const run = bundle.moments.find((moment) => moment.id === "run")!;
    await panel.getByRole("button", { name: new RegExp(run.title) }).click();
    await expect(
      panel.getByRole("heading", { name: headline, exact: true }),
    ).toBeVisible();
    await expect(panel.locator(".primary-finding")).toContainText(happened);
    await expect(panel.locator(".evidence-qualification")).toHaveText(
      "Based on recorded geometry and an authored tactical reading. Intent and alternative outcomes are unknown.",
    );
    for (const [category, momentId] of [
      ["movement", "run"],
      ["relationships", "pass"],
      ["corridor", "pass"],
      ["space", id === "the-missed-chance" ? "recovery" : "receive"],
      ["finish", "finish"],
    ] as const) {
      const moment = bundle.moments.find((moment) => moment.id === momentId)!;
      const fact = moment.evidenceIds
        .map((id) => bundle.evidence.find((f) => f.id === id)!)
        .find((f) => f.category === category)!;
      await panel
        .getByRole("button", { name: new RegExp(moment.title) })
        .click();
      const card = page.locator(`.insight-card[data-evidence-id="${fact.id}"]`);
      await card.locator("summary").click();
      await card.getByRole("button", { name: /Watch this/ }).click();
      const guide = page.getByTestId("guided-replay");
      await expect(guide).toHaveAttribute("data-evidence-id", fact.id);
      await expect(guide).toHaveAttribute("data-status", "playing");
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-guided-evidence",
        fact.id,
      );
      await page
        .getByTestId("replay-viewport")
        .screenshot({
          path: `../output/playwright/pre-3d/${id}-${category}.png`,
        });
      await guide
        .getByRole("button", { name: "Back to analysis", exact: true })
        .click();
      await expect(page.getByTestId("tactical-moment-title")).toHaveText(
        moment.title,
      );
    }
    expect(errors).toEqual([]);
  });
}

test("mobile tactical controls and evidence remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Analyze this moment" }).click();
  await expect(page.getByTestId("tactical-moment-title")).toBeVisible();
  await page
    .getByRole("region", { name: "Tactical analysis" })
    .getByRole("button", { name: /The Arrival/ })
    .click();
  await expect(page.getByTestId("replay-time")).toContainText("5.6");
  await page
    .getByRole("checkbox", { name: "Space & coverage", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Player relationships", exact: true })
    .check();
  await page.getByRole("button", { name: "Tactical", exact: true }).click();
  await settle(page);
  await page
    .getByTestId("replay-viewport")
    .screenshot({ path: "../output/playwright/tactics/mobile-viewport.png" });
  await page.screenshot({
    path: "../output/playwright/tactics/mobile-evidence.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
