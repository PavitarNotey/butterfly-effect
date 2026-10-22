import { create } from 'zustand'
import type { EvidenceBundle, Layer } from './types'

export interface TacticalState {
  enabled: boolean
  layers: Record<Layer, boolean>
  bundle: EvidenceBundle | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
  attempt: number
  setEnabled: (enabled: boolean) => void
  toggleLayer: (layer: Layer) => void
  reveal: (layer: Layer) => void
  retry: () => void
}
export const useTactics = create<TacticalState>((set) => ({
  enabled: false, layers: { passing: true, movement: false, space: false, relationships: false },
  bundle: null, status: 'idle', error: '', attempt: 0,
  setEnabled: enabled => set({ enabled }),
  toggleLayer: layer => set(s => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  reveal: layer => set(s => ({ layers: { ...s.layers, [layer]: true } })),
  retry: () => set(s => ({ attempt: s.attempt + 1, status: 'idle' })),
}))
