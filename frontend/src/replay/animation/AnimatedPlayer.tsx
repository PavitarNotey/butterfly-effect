import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createCharacter } from "./characterAssets";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { sampleAnimation } from "./animationSampler";
import type { Player, Scenario } from "../types";

/**
 * Own one independent character instance and evaluate its pose from the supplied replay-time reader.
 * Cleanup releases that instance while retaining shared geometry, clips and pooled materials.
 */
export function AnimatedPlayer({
  asset,
  player,
  scenario,
  color,
  readTime,
}: {
  asset: GLTF;
  player: Player;
  scenario: Scenario;
  color: string;
  readTime: () => number;
}) {
  const root = useRef<THREE.Group>(null);
  const instance = useRef<ReturnType<typeof createCharacter> | null>(null);
  const evaluatedTime = useRef<number | null>(null);
  useEffect(() => {
    const character = createCharacter(
      asset,
      color,
      player.number,
      player.role === "Goalkeeper",
    );
    const group = root.current!;
    instance.current = character;
    evaluatedTime.current = null;
    character.evaluate(sampleAnimation(scenario, player, readTime()));
    group.add(character.scene);
    return () => {
      instance.current = null;
      group.remove(character.scene);
      character.dispose();
    };
  }, [asset, color, scenario, player, readTime]);
  useFrame(() => {
    const time = readTime();
    if (time === evaluatedTime.current) return;
    instance.current?.evaluate(sampleAnimation(scenario, player, time));
    evaluatedTime.current = time;
  });
  return (
    <group
      ref={root}
      position={[0, 0.01, 0]}
      dispose={null}
      name={`SkeletalPlayer:${player.id}`}
      userData={{
        playerId: player.id,
        teamId: player.teamId,
        goalkeeper: player.role === "Goalkeeper",
      }}
    />
  );
}
