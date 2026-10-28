import { useEffect, useState } from "react";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { loadCharacter } from "./characterAssets";

/** One team-level load state prevents partial rosters and stale async updates.
 *
 * @param enabled - Whether this roster requests the shared skeletal asset.
 * @returns The loaded source GLTF or null while disabled, loading or failed.
 */
export function useCharacterAsset(enabled: boolean) {
  const [asset, setAsset] = useState<GLTF | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadCharacter()
      .then((model) => {
        if (active) setAsset(model);
      })
      .catch(() => {
        // All selected characters retain the proven procedural renderer.
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? asset : null;
}
