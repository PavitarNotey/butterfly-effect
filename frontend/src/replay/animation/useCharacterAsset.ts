import { useEffect, useState } from 'react'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loadCharacter } from './characterAssets'

/** One team-level load state prevents partial rosters and stale async updates. */
export function useCharacterAsset(enabled: boolean) {
  const [asset, setAsset] = useState<GLTF | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void loadCharacter().then(model => { if (active) setAsset(model) }).catch(() => {
      // All selected characters retain the proven procedural renderer.
    })
    return () => { active = false }
  }, [enabled])
  return enabled ? asset : null
}

