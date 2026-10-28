/// <reference types="node" />
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { scenarios } from "../scenario";
import { samplePosition, sampleYaw } from "../sample";
import { sampleReaction } from "./reactions";
import { sampleAnimation } from "./animationSampler";
import { createCharacter } from "./characterAssets";

async function model() {
  const bytes = readFileSync(
    new URL("../../../public/characters/football-player.glb", import.meta.url),
  );
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}
function snapshot(scene: THREE.Object3D) {
  const pose: number[] = [];
  scene.traverse((b) => {
    if (b instanceof THREE.Bone)
      pose.push(...b.position.toArray(), ...b.quaternion.toArray());
  });
  return pose;
}

it("nearby teammates celebrate only after the goal while conceding defenders finish their brace before reacting", () => {
  const s = scenarios[0],
    goal = s.events.find((e) => e.type === "goal")!.t;
  for (const id of ["a7", "a8", "a10"]) {
    const p = s.players.find((p) => p.id === id)!;
    expect(sampleReaction(s, p, goal)).toBeNull();
    expect(sampleReaction(s, p, goal + 1.2)?.kind).toBe("celebrate");
  }
  const defender = s.players.find((p) => p.id === "d5")!;
  expect(sampleReaction(s, defender, goal + 1.5)).toBeNull();
  expect(sampleReaction(s, defender, goal + 2.2)?.kind).toBe("disappointed");
});

describe.each(scenarios)("$id reaction timing", (s) => {
  it("reacts to the actual shot and only celebrates or expresses disappointment after the outcome", () => {
    const shot = s.events.find((e) => e.type === "shot")!,
      outcome = s.events.find((e) => e.type === "goal" || e.type === "miss")!,
      shooter = s.players.find((p) => p.id === outcome.playerIds[0])!;
    const keeper = s.players.find(
      (p) => p.role === "Goalkeeper" && p.teamId !== shooter.teamId,
    )!;
    expect(sampleReaction(s, keeper, shot.t - 1)).toBeNull();
    expect(sampleReaction(s, keeper, shot.t + 0.35)?.kind).toBe(
      outcome.type === "goal" ? "keeper-dive" : "keeper-track",
    );
    expect(sampleReaction(s, shooter, outcome.t)).toBeNull();
    expect(sampleReaction(s, shooter, outcome.t + 0.5)?.kind).toBe(
      outcome.type === "goal" ? "celebrate" : "disappointed",
    );
    expect(sampleReaction(s, shooter, 20)).toBeNull();
    expect(sampleReaction(s, keeper, 20)).toBeNull();
  });
});

it("samples independent deterministic reaction bones across all 22 players and preserves tracks, roots, source rig and clips", async () => {
  const asset = await model(),
    sourcePose = snapshot(asset.scene),
    canonical = JSON.stringify(scenarios),
    clips = JSON.stringify(asset.animations.map((c) => c.toJSON()));
  const point = new THREE.Vector3(),
    ball = new THREE.Vector3(),
    triangle = new THREE.Triangle(),
    closest = new THREE.Vector3(),
    records: object[] = [];
  for (const s of scenarios)
    for (const player of s.players) {
      const rig = createCharacter(asset, "#abcdee"),
        parent = new THREE.Group();
      parent.add(rig.scene);
      const root = rig.scene.getObjectByName("root")!,
        rootPose = [...root.position.toArray(), ...root.quaternion.toArray()];
      let mesh: THREE.SkinnedMesh | undefined;
      rig.scene.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) mesh = o;
      });
      const times = [
        0, 3, 6, 8.5, 10.4, 13.4, 14, 14.18, 14.3, 14.48, 14.67, 15, 15.4,
        15.72, 16, 16.5, 17.5, 19, 20,
      ];
      const poses = new Map<number, number[]>();
      let minY = Infinity,
        maxRadius = 0,
        minBallGap = Infinity,
        closestTime = 0;
      function evaluate(t: number) {
        parent.position.set(...samplePosition(player.positions, t));
        parent.rotation.y = sampleYaw(player.facing, t);
        parent.updateMatrixWorld(true);
        rig.evaluate(sampleAnimation(s, player, t));
        parent.updateMatrixWorld(true);
      }
      for (const time of times) {
        evaluate(time);
        const pose = snapshot(rig.scene);
        expect(pose.every(Number.isFinite)).toBe(true);
        poses.set(time, pose);
        expect([
          ...root.position.toArray(),
          ...root.quaternion.toArray(),
        ]).toEqual(rootPose);
        if (player.role !== "Goalkeeper" && sampleReaction(s, player, time)) {
          for (let i = 0; i < mesh!.geometry.attributes.position.count; i++) {
            mesh!.getVertexPosition(i, point);
            expect(point.distanceTo(mesh!.boundingSphere!.center)).toBeLessThan(
              mesh!.boundingSphere!.radius,
            );
            expect(point.y + 0.01).toBeGreaterThan(-0.035);
          }
        }
      }
      for (const time of [...times].reverse()) {
        evaluate(time);
        expect(snapshot(rig.scene)).toEqual(poses.get(time));
      }
      if (
        player.role === "Goalkeeper" &&
        sampleReaction(s, player, s.events.find((e) => e.type === "shot")!.t)
      ) {
        const shot = s.events.find((e) => e.type === "shot")!,
          outcome = s.events.find(
            (e) => e.type === "goal" || e.type === "miss",
          )!;
        for (let t = shot.t - 0.9; t <= shot.t + 3; t += 0.04) {
          evaluate(t);
          ball.set(...samplePosition(s.ball, t));
          const worldPoints: THREE.Vector3[] = [];
          for (let i = 0; i < mesh!.geometry.attributes.position.count; i++) {
            mesh!.getVertexPosition(i, point);
            maxRadius = Math.max(
              maxRadius,
              point.distanceTo(mesh!.boundingSphere!.center),
            );
            minY = Math.min(minY, point.y + 0.01);
            if (t >= shot.t && t <= outcome.t)
              worldPoints.push(point.clone().applyMatrix4(mesh!.matrixWorld));
          }
          if (worldPoints.length) {
            const indices = mesh!.geometry.index!;
            for (let i = 0; i < indices.count; i += 3) {
              triangle
                .set(
                  worldPoints[indices.getX(i)],
                  worldPoints[indices.getX(i + 1)],
                  worldPoints[indices.getX(i + 2)],
                )
                .closestPointToPoint(ball, closest);
              const gap = closest.distanceTo(ball) - 0.16;
              if (gap < minBallGap) {
                minBallGap = gap;
                closestTime = t;
              }
            }
          }
          expect(maxRadius).toBeLessThan(mesh!.boundingSphere!.radius);
        }
        expect(minY).toBeGreaterThan(-0.035);
        expect(
          minBallGap,
          `${player.id} closest surface at ${closestTime}s`,
        ).toBeGreaterThan(0.08);
        records.push({
          scenario: s.id,
          keeper: player.id,
          maxVertexRadius: maxRadius,
          minY,
          minBallGap,
          closestTime,
        });
      }
      rig.dispose();
      rig.dispose();
    }
  expect(snapshot(asset.scene)).toEqual(sourcePose);
  expect(JSON.stringify(asset.animations.map((c) => c.toJSON()))).toBe(clips);
  expect(JSON.stringify(scenarios)).toBe(canonical);
  const path = new URL(
    "../../../../output/playwright/phase3c/",
    import.meta.url,
  );
  mkdirSync(path, { recursive: true });
  writeFileSync(
    new URL("reaction-safety.json", path),
    JSON.stringify(records, null, 2),
  );
}, 30000);

it("has continuous blends at shot, outcome, landing and recovery boundaries", async () => {
  const asset = await model();
  for (const s of scenarios) {
    const outcome = s.events.find(
        (e) => e.type === "goal" || e.type === "miss",
      )!,
      shot = s.events.find((e) => e.type === "shot")!,
      shooter = s.players.find((p) => p.id === outcome.playerIds[0])!;
    const keeper = s.players.find(
      (p) => p.role === "Goalkeeper" && p.teamId !== shooter.teamId,
    )!;
    for (const player of [shooter, keeper]) {
      const rig = createCharacter(asset, "#abcdee");
      for (const t of [
        shot.t - 0.9,
        shot.t - 0.3,
        shot.t + 0.18,
        shot.t + 0.65,
        shot.t + 1,
        shot.t + 2.1,
        shot.t + 3,
        outcome.t + 0.18,
        outcome.t + 0.75,
        outcome.t + 3,
        outcome.t + 4.6,
      ]) {
        rig.evaluate(sampleAnimation(s, player, t - 0.00001));
        const before = snapshot(rig.scene);
        rig.evaluate(sampleAnimation(s, player, t + 0.00001));
        const after = snapshot(rig.scene);
        for (let i = 0; i < before.length; i += 7) {
          expect(
            new THREE.Vector3(
              ...(before.slice(i, i + 3) as [number, number, number]),
            ).distanceTo(
              new THREE.Vector3(
                ...(after.slice(i, i + 3) as [number, number, number]),
              ),
            ),
            `${s.id} ${player.id} position t=${t}`,
          ).toBeLessThan(0.003);
          expect(
            new THREE.Quaternion(
              ...(before.slice(i + 3, i + 7) as [
                number,
                number,
                number,
                number,
              ]),
            ).angleTo(
              new THREE.Quaternion(
                ...(after.slice(i + 3, i + 7) as [
                  number,
                  number,
                  number,
                  number,
                ]),
              ),
            ),
            `${s.id} ${player.id} rotation t=${t}`,
          ).toBeLessThan(0.003);
        }
      }
      rig.dispose();
    }
  }
});
