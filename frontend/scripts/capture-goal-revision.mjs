/* global process */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const label = process.argv[2] ?? "after";
const cameras = (
  process.argv.find((arg) => arg.startsWith("--cameras="))?.split("=")[1] ??
  "broadcast,tactical"
).split(",");
const folder = `../output/playwright/phase3c2/${label}`;
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const mode of cameras) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      recordVideo: {
        dir: `${folder}/raw`,
        size: { width: 1440, height: 1100 },
      },
    });
    const started = performance.now(),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:5173/studio");
    await page.waitForFunction(
      () =>
        document.querySelector("canvas")?.dataset.characterRenderer ===
        "skeletal",
    );
    if (mode === "tactical")
      await page.getByRole("button", { name: "Tactical", exact: true }).click();
    await page.getByTestId("replay-viewport").scrollIntoViewIfNeeded();
    const playOffset = (performance.now() - started) / 1000;
    await page
      .getByRole("button", { name: "Play replay", exact: true })
      .click();
    const live = await page.evaluate(async () => {
      const entries = performance.getEntriesByType("resource");
      const { replayStore } = await import(
        entries.find((e) => new URL(e.name).pathname === "/src/replay/store.ts")
          .name
      );
      const samples = [],
        start = performance.now();
      let next = 0;
      while (replayStore.getState().playing) {
        await new Promise(requestAnimationFrame);
        const state = replayStore.getState(),
          t = state.readTime();
        if (t >= next) {
          samples.push({ wall: (performance.now() - start) / 1000, time: t });
          next += 0.25;
        }
      }
      return {
        duration: replayStore.getState().scenario.duration,
        events: replayStore.getState().scenario.events,
        samples,
      };
    });
    const video = page.video();
    await page
      .getByTestId("replay-viewport")
      .screenshot({ path: `${folder}/${mode}-end.png` });
    await context.close();
    await video.saveAs(`${folder}/${mode}-continuous-1x.webm`);
    await writeFile(
      `${folder}/${mode}-recording.json`,
      JSON.stringify({ playOffset, ...live, errors }, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        label,
        mode,
        duration: live.duration,
        playOffset,
        errors,
      }),
    );
  }
} finally {
  await browser.close();
}
