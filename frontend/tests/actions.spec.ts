import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Object3D } from "three";
import invisible from "../src/replay/invisible-run.json" with { type: "json" };
import missed from "../src/replay/missed-chance.json" with { type: "json" };
import { samplePosition } from "../src/replay/sample";

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function inspect(page: Page, id: string) {
  await settle(page);
  return page.evaluate(async (id) => {
    const entries = performance.getEntriesByType("resource");
    const fiber = await import(
      entries.find((e) => e.name.includes("@react-three_fiber.js"))!.name
    );
    const { replayStore } = await import(
      entries.find((e) => new URL(e.name).pathname === "/src/replay/store.ts")!
        .name
    );
    const { sampleFootballAction } = await import(
      entries.find(
        (e) =>
          new URL(e.name).pathname ===
          "/src/replay/animation/footballActions.ts",
      )!.name
    );
    const state = fiber._roots
        .get(document.querySelector("canvas"))
        .store.getState(),
      replay = replayStore.getState();
    const root = state.scene.getObjectByName(`Player:${id}`),
      rig = state.scene.getObjectByName(`SkeletalPlayer:${id}`);
    const bones: number[] = [];
    rig.traverse((bone: Object3D) => {
      if (bone.type === "Bone")
        bones.push(...bone.position.toArray(), ...bone.quaternion.toArray());
    });
    let ball;
    state.scene.traverse(
      (
        object: Object3D & { geometry?: { parameters?: { radius: number } } },
      ) => {
        if (object.geometry?.parameters?.radius === 0.16)
          ball = object.position.toArray();
      },
    );
    return {
      time: replay.readTime(),
      bones,
      position: root.position.toArray(),
      scale: rig.scale.toArray(),
      ball,
      actors: replay.scenario.players
        .map((p: { id: string }) =>
          sampleFootballAction(replay.scenario, p, replay.readTime()),
        )
        .filter(Boolean)
        .map((a: { actorId: string; kind: string }) => [a.actorId, a.kind]),
    };
  }, id);
}
async function seekExact(page: Page, time: number) {
  await page.evaluate(async (time) => {
    const entry = performance
      .getEntriesByType("resource")
      .find((e) => new URL(e.name).pathname === "/src/replay/store.ts")!;
    const { replayStore } = await import(entry.name);
    replayStore.getState().seek(time);
  }, time);
}
async function setPov(page: Page, id: string) {
  await page.evaluate(async (id) => {
    const entry = performance
      .getEntriesByType("resource")
      .find((e) => new URL(e.name).pathname === "/src/replay/store.ts")!;
    const { replayStore } = await import(entry.name);
    replayStore.getState().setCamera(`pov:${id}`);
  }, id);
}

test("all six actions preserve actual bone poses, canonical ball, cameras, restart and live playback", async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [],
    assets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /THREE|WebGL|shader/.test(message.text()))
      errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/characters/football-player.glb"))
      assets.push(request.url());
    if (!["localhost", "127.0.0.1"].includes(new URL(request.url()).hostname))
      external.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/studio");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-character-renderer",
    "skeletal",
  );
  const timeline = page.getByRole("slider", { name: "Replay timeline" });
  for (const [scenario, actions] of [
    [
      invisible,
      [
        ["a8", "pass", 4.4],
        ["a9", "receive", 5.6],
        ["a9", "shot", 6.8],
      ],
    ],
    [
      missed,
      [
        ["s8", "pass", 3.55],
        ["s9", "receive", 4.75],
        ["s9", "shot", 7.65],
      ],
    ],
  ] as const) {
    await page
      .getByRole("combobox", { name: "Scenario", exact: true })
      .selectOption(scenario.id);
    for (const [id, kind, contact] of actions) {
      for (const offset of [-0.25, 0, 0.2]) {
        const time = Number((contact + offset).toFixed(2));
        await timeline.fill(String(time));
        const expected = await inspect(page, id);
        expect(expected.actors).toEqual([[id, kind]]);
        expect(expected.bones).toHaveLength(65 * 7);
        expect(expected.bones.every(Number.isFinite)).toBe(true);
        expect(expected.scale).toEqual([1, 1, 1]);
        expect(expected.position).toEqual(
          samplePosition(
            scenario.players.find((p) => p.id === id)!.positions,
            time,
          ),
        );
        expect(expected.ball).toEqual(samplePosition(scenario.ball, time));
        for (const speed of ["0.5", "1", "2"]) {
          await page
            .getByRole("combobox", { name: "Playback speed" })
            .selectOption(speed);
          await timeline.fill(String(scenario.duration - 0.5));
          await timeline.fill("0");
          await timeline.fill(String(time));
          expect(await inspect(page, id)).toEqual(expected);
        }
        await page
          .getByRole("button", { name: "Restart replay", exact: true })
          .click();
        await timeline.fill(String(time));
        expect(await inspect(page, id)).toEqual(expected);
        for (const button of ["Tactical", "Full pitch", "Broadcast"]) {
          await page.getByRole("button", { name: button, exact: true }).click();
          expect(await inspect(page, id)).toEqual(expected);
        }
        await setPov(page, id);
        expect(await inspect(page, id)).toEqual(expected);
        await page
          .getByRole("button", { name: "Broadcast", exact: true })
          .click();
      }
    }
    // Reach a shot through the real advancing clock, freeze its exact timestamp,
    // then seek away/back through the same mounted store (not a rounded slider).
    const id = actions[2][0],
      contact = actions[2][2];
    for (const speed of ["0.5", "1", "2"]) {
      await page
        .getByRole("combobox", { name: "Playback speed" })
        .selectOption(speed);
      await timeline.fill(String(Number((contact - 0.4).toFixed(2))));
      await page
        .getByRole("button", { name: "Play replay", exact: true })
        .click();
      await expect
        .poll(async () => Number(await timeline.inputValue()), {
          intervals: [25],
        })
        .toBeGreaterThan(contact - 0.02);
      // Freeze at the poll boundary without adding viewport auto-scroll latency.
      await page.evaluate(async () => {
        const entry = performance
          .getEntriesByType("resource")
          .find((e) => new URL(e.name).pathname === "/src/replay/store.ts")!;
        const { replayStore } = await import(entry.name);
        replayStore.getState().pause();
      });
      const live = await inspect(page, id);
      expect(live.time).toBeGreaterThan(contact - 0.02);
      expect(live.time).toBeLessThan(contact + 0.5);
      await seekExact(page, scenario.duration);
      await seekExact(page, 0);
      await seekExact(page, live.time);
      expect(await inspect(page, id)).toEqual(live);
      const other = scenario.id === invisible.id ? missed.id : invisible.id;
      await page
        .getByRole("combobox", { name: "Scenario", exact: true })
        .selectOption(other);
      await page
        .getByRole("combobox", { name: "Scenario", exact: true })
        .selectOption(scenario.id);
      await seekExact(page, live.time);
      expect(await inspect(page, id)).toEqual(live);
    }
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(assets).toHaveLength(1);
});
