/* global process */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Box3, Vector3 } from "three";

const label = process.argv[2] ?? "after";
const folder = `../output/framing/${label}`;
await mkdir(folder, { recursive: true });
const bytes = await readFile(
  new URL("../public/characters/football-player.glb", import.meta.url),
);
const asset = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
asset.scene.updateMatrixWorld(true);
const bounds = new Box3(),
  point = new Vector3();
asset.scene.traverse((mesh) => {
  if (!mesh.isSkinnedMesh) return;
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
    bounds.expandByPoint(
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld),
    );
});
const report = {
  bindHeightM: bounds.max.y - bounds.min.y,
  bindMinY: bounds.min.y,
  bindMaxY: bounds.max.y,
  cases: [],
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1.5,
  });
  await page.goto("http://localhost:5173/studio");
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.dataset.characterRenderer ===
      "skeletal",
  );
  for (const scenario of ["the-invisible-run", "the-missed-chance"]) {
    await page
      .getByRole("combobox", { name: "Scenario", exact: true })
      .selectOption(scenario);
    for (const time of [0, 9, 14]) {
      await page
        .getByRole("slider", { name: "Replay timeline" })
        .fill(String(time));
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const measurement = await page.evaluate(async () => {
        const entries = performance.getEntriesByType("resource");
        const fiber = await import(
          entries.find((e) => e.name.includes("@react-three_fiber.js")).name
        );
        const THREE = await import(
          entries.find((e) => /\/three\.js\?/.test(e.name)).name
        );
        const { replayStore } = await import(
          entries.find(
            (e) => new URL(e.name).pathname === "/src/replay/store.ts",
          ).name
        );
        const { samplePosition } = await import(
          entries.find(
            (e) => new URL(e.name).pathname === "/src/replay/sample.ts",
          ).name
        );
        const state = fiber._roots
          .get(document.querySelector("canvas"))
          .store.getState();
        state.scene.updateMatrixWorld(true);
        const players = [],
          p = new THREE.Vector3();
        state.scene.traverse((root) => {
          if (!root.name.startsWith("SkeletalPlayer:")) return;
          const box = new THREE.Box3(),
            id = root.userData.playerId;
          root.traverse((mesh) => {
            if (!mesh.isSkinnedMesh) return;
            for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
              box.expandByPoint(
                mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld),
              );
          });
          const canonical = replayStore
            .getState()
            .scenario.players.find((player) => player.id === id);
          const position = samplePosition(
            canonical.positions,
            replayStore.getState().readTime(),
          );
          const error = root.parent.position.distanceTo(
            new THREE.Vector3(...position),
          );
          players.push({
            id,
            team: root.userData.teamId,
            heightM: box.max.y - box.min.y,
            footY: box.min.y - position[1],
            rootErrorM: error,
            scale: root.getWorldScale(new THREE.Vector3()).toArray(),
          });
        });
        return players;
      });
      report.cases.push({ scenario, time, players: measurement });
      if (time === 0) continue;
      for (const camera of label === "before"
        ? ["Broadcast", "Tactical"]
        : ["Broadcast", "Tactical", "Full pitch"]) {
        await page.getByRole("button", { name: camera, exact: true }).click();
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await page
          .locator("canvas")
          .screenshot({
            path: `${folder}/${scenario}-${time}-${camera.toLowerCase().replace(" ", "-")}.png`,
          });
      }
    }
  }
  await writeFile(
    `${folder}/scale-audit.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      label,
      bindHeightM: report.bindHeightM,
      poseHeightRangeM: [
        Math.min(
          ...report.cases.flatMap((c) => c.players.map((p) => p.heightM)),
        ),
        Math.max(
          ...report.cases.flatMap((c) => c.players.map((p) => p.heightM)),
        ),
      ],
      footRangeM: [
        Math.min(...report.cases.flatMap((c) => c.players.map((p) => p.footY))),
        Math.max(...report.cases.flatMap((c) => c.players.map((p) => p.footY))),
      ],
      maxRootErrorM: Math.max(
        ...report.cases.flatMap((c) => c.players.map((p) => p.rootErrorM)),
      ),
    }),
  );
} finally {
  await browser.close();
}
