/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { scenario, scenarios } from "../scenario";
import { createReplayStore } from "../store";
import { sampleAnimation } from "./animationSampler";
import { createCharacter, validateCharacter } from "./characterAssets";
import { kitResources } from "./kitMaterial";

const voss = scenario.players.find((player) => player.id === "a9")!;
async function asset() {
  const bytes = readFileSync(
    new URL("../../../public/characters/football-player.glb", import.meta.url),
  );
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}
function bones(root: THREE.Object3D) {
  const result: THREE.Bone[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Bone) result.push(object);
  });
  return result;
}
function pose(root: THREE.Object3D) {
  return bones(root).flatMap((bone) => [
    ...bone.position.toArray(),
    ...bone.quaternion.toArray(),
    ...bone.scale.toArray(),
  ]);
}

describe("absolute replay animation sampling", () => {
  it("repeats after arbitrary backward seeks, restart and every playback speed", () => {
    let now = 0;
    const store = createReplayStore(() => now);
    const expected = sampleAnimation(scenario, voss, 10.4);
    for (const speed of [0.5, 1, 2] as const) {
      store.getState().setSpeed(speed);
      store.getState().restart();
      store.getState().play();
      now += 10400 / speed;
      expect(
        sampleAnimation(scenario, voss, store.getState().readTime()),
      ).toEqual(expected);
      store.getState().pause();
      store.getState().seek(20);
      store.getState().seek(10.4);
      now += 1000;
      expect(
        sampleAnimation(scenario, voss, store.getState().readTime()),
      ).toEqual(expected);
    }
  });
  it("smooths weights and keeps phase continuous at every canonical position key", () => {
    for (const key of voss.positions.slice(1, -1)) {
      const before = sampleAnimation(scenario, voss, key.t - 0.00001);
      const after = sampleAnimation(scenario, voss, key.t + 0.00001);
      expect(Math.abs(before.speed - after.speed)).toBeLessThan(0.001);
      expect(Math.abs(before.cycles - after.cycles)).toBeLessThan(0.001);
      for (const state of ["idle", "walk", "jog"] as const)
        expect(
          Math.abs(before.weights[state] - after.weights[state]),
        ).toBeLessThan(0.001);
    }
  });
  it("handles endpoints, invalid time and stationary tracks with finite normalized weights", () => {
    for (const s of scenarios)
      for (const p of s.players)
        for (const t of [NaN, -1, 0, 3, 9, 10.4, 14, 20, Infinity]) {
          const sample = sampleAnimation(s, p, t);
          expect(
            [
              sample.speed,
              sample.cycles,
              sample.idleTime,
              sample.travelAngle,
              ...Object.values(sample.weights),
            ].every(Number.isFinite),
          ).toBe(true);
          expect(
            Object.values(sample.weights).reduce((a, b) => a + b),
          ).toBeCloseTo(1);
          expect(
            Math.min(...Object.values(sample.weights)),
          ).toBeGreaterThanOrEqual(0);
        }
    const stationary = {
      ...voss,
      positions: voss.positions.map((key) => ({
        ...key,
        position: voss.positions[0].position,
      })),
    };
    expect(sampleAnimation(scenario, stationary, 9).weights).toEqual({
      idle: 1,
      walk: 0,
      jog: 0,
    });
    expect(sampleAnimation(scenario, voss, 0).weights.walk).toBeGreaterThan(
      0.8,
    );
    expect(sampleAnimation(scenario, voss, 9).weights.jog).toBeGreaterThan(0.9);
    expect(sampleAnimation(scenario, voss, 0).backward).toBe(0);
    expect(sampleAnimation(scenario, voss, 10.4).backward).toBe(0);
  });
});

describe("real imported skeletal poses", () => {
  it("rejects parseable assets with missing rig bones or clips before rendering", async () => {
    const model = await asset();
    expect(validateCharacter(model)).toBe(model);
    const pelvis = model.scene.getObjectByName("pelvis")!;
    pelvis.name = "incorrect";
    expect(() => validateCharacter(model)).toThrow(
      "Incompatible skeletal asset",
    );
    pelvis.name = "pelvis";
    model.animations = [];
    expect(() => validateCharacter(model)).toThrow("Missing locomotion clips");
  });
  it("renders both complete rosters with independent skeletons, correct kits and released resources", async () => {
    const model = await asset();
    const meshes = (root: THREE.Object3D) => {
      const result: THREE.SkinnedMesh[] = [];
      root.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) result.push(object);
      });
      return result;
    };
    const initial = kitResources();
    for (const s of scenarios) {
      const characters = s.players.map((player) => {
        const team = s.teams.find((team) => team.id === player.teamId)!;
        const goalkeeper = player.role === "Goalkeeper";
        return createCharacter(
          model,
          goalkeeper ? team.goalkeeperColor : team.color,
          player.number,
          goalkeeper,
        );
      });
      expect(characters).toHaveLength(22);
      expect(
        new Set(
          characters.map((character) => meshes(character.scene)[0].skeleton),
        ).size,
      ).toBe(22);
      expect(
        new Set(characters.map((character) => bones(character.scene)[0])).size,
      ).toBe(22);
      expect(
        new Set(
          characters.map((character) => meshes(character.scene)[0].geometry),
        ).size,
      ).toBe(1);
      const expected: number[][] = [];
      characters.forEach((character, index) => {
        const player = s.players[index],
          team = s.teams.find((team) => team.id === player.teamId)!;
        const mesh = meshes(character.scene)[0];
        const material = mesh.material as THREE.Material;
        expect(meshes(character.scene)).toHaveLength(1);
        expect(mesh.frustumCulled).toBe(true);
        expect(material.userData).toEqual({
          color:
            player.role === "Goalkeeper" ? team.goalkeeperColor : team.color,
          number: player.number,
          goalkeeper: player.role === "Goalkeeper",
        });
        character.evaluate(sampleAnimation(s, player, 9));
        expected.push(pose(character.scene));
      });
      for (const t of [20, 0, 14, 3, 10.4, 9])
        characters.forEach((character, i) =>
          character.evaluate(sampleAnimation(s, s.players[i], t)),
        );
      characters.forEach((character, i) =>
        expect(pose(character.scene)).toEqual(expected[i]),
      );
      expect(
        new Set(expected.map((pose) => JSON.stringify(pose))).size,
      ).toBeGreaterThan(15);
      characters.forEach((character) => {
        character.dispose();
        character.dispose();
      });
      expect(kitResources()).toEqual(initial);
    }
  });

  it("shares matching kit materials until the last owner releases them", async () => {
    const model = await asset(),
      before = kitResources();
    const a = createCharacter(model, "#abcdef", 7),
      b = createCharacter(model, "#abcdef", 7);
    expect(kitResources().materials).toBe(before.materials + 1);
    expect(kitResources().references).toBe(before.references + 2);
    a.dispose();
    b.evaluate(sampleAnimation(scenario, voss, 9));
    expect(kitResources().references).toBe(before.references + 1);
    b.dispose();
    expect(kitResources()).toEqual(before);
  });

  it("keeps every deformed vertex inside the conservative animated culling envelope", async () => {
    const character = createCharacter(await asset(), "#abcdef");
    let mesh: THREE.SkinnedMesh | undefined;
    character.scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) mesh = object;
    });
    const point = new THREE.Vector3();
    for (const state of ["idle", "walk", "jog"] as const)
      for (let phase = 0; phase < 1; phase += 0.05) {
        const sample = sampleAnimation(scenario, voss, 9);
        sample.weights = { idle: 0, walk: 0, jog: 0 };
        sample.weights[state] = 1;
        sample.cycles = phase;
        sample.idleTime = phase * 2.5;
        character.evaluate(sample);
        character.scene.updateMatrixWorld(true);
        for (
          let i = 0;
          i < mesh!.geometry.getAttribute("position").count;
          i++
        ) {
          mesh!.getVertexPosition(i, point);
          expect(mesh!.boundingSphere!.containsPoint(point)).toBe(true);
        }
      }
    character.dispose();
  });

  it("evaluates identical bone transforms after forward/backward/paused samples", async () => {
    const model = await asset();
    const character = createCharacter(model, "#77bbdd");
    expect(bones(character.scene)).toHaveLength(65);
    const root = character.scene.getObjectByName("root")!;
    const rootTransform = [
      ...root.position.toArray(),
      ...root.quaternion.toArray(),
    ];
    const snapshots: number[][] = [];
    for (const t of [0, 3, 9, 10.4, 14, 20]) {
      character.evaluate(sampleAnimation(scenario, voss, t));
      const expected = pose(character.scene);
      snapshots.push(expected);
      character.evaluate(sampleAnimation(scenario, voss, 19));
      character.evaluate(sampleAnimation(scenario, voss, 1));
      character.evaluate(sampleAnimation(scenario, voss, t));
      expect(pose(character.scene)).toEqual(expected);
      character.evaluate(sampleAnimation(scenario, voss, t));
      expect(pose(character.scene)).toEqual(expected);
      expect([
        ...root.position.toArray(),
        ...root.quaternion.toArray(),
      ]).toEqual(rootTransform);
      expect(expected.every(Number.isFinite)).toBe(true);
    }
    expect(snapshots[0]).not.toEqual(snapshots[2]);
    expect(
      model.animations.every((clip) =>
        clip.tracks.every((track) => !track.name.startsWith("root.")),
      ),
    ).toBe(true);
    character.dispose();
  });
  it("shares geometry but isolates bones, materials and mixers; disposing one leaves the other usable", async () => {
    const model = await asset();
    const a = createCharacter(model, "#77bbdd"),
      b = createCharacter(model, "#aabbcc");
    expect(bones(a.scene)[0]).not.toBe(bones(b.scene)[0]);
    const meshes = (root: THREE.Object3D) => {
      const result: THREE.SkinnedMesh[] = [];
      root.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) result.push(object);
      });
      return result;
    };
    expect(meshes(a.scene)[0].geometry).toBe(meshes(b.scene)[0].geometry);
    expect(meshes(a.scene)[0].material).not.toBe(meshes(b.scene)[0].material);
    b.evaluate(sampleAnimation(scenario, voss, 3));
    const expected = pose(b.scene);
    a.evaluate(sampleAnimation(scenario, voss, 14));
    expect(pose(b.scene)).toEqual(expected);
    a.dispose();
    b.evaluate(sampleAnimation(scenario, voss, 3));
    expect(pose(b.scene)).toEqual(expected);
    b.dispose();
  });
});
