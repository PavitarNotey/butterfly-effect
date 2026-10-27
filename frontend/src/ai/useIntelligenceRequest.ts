import { useCallback, useEffect, useRef, useState } from 'react'
import type { Intelligence } from './client'

type Loader = (signal: AbortSignal, cacheOnly: boolean) => Promise<Intelligence | null>
interface Result {
  key: string
  revision: number
  data: Intelligence | null
  error: Error | null
  pending: boolean
}

/** Effects only read saved results. Only an explicit event may allow generation. */
export function useIntelligenceRequest(key: string, load: Loader, enabled = false) {
  const [result, setResult] = useState<Result | null>(null)
  const active = useRef<{ key: string; controller: AbortController } | null>(null)
  const sequence = useRef(0)
  const lastIntent = useRef({ key, cacheOnly: false })
  const run = useCallback((requestKey: string, loader: Loader, cacheOnly: boolean) => {
    if (active.current?.key === requestKey) return
    active.current?.controller.abort()
    const controller = new AbortController()
    active.current = { key: requestKey, controller }
    lastIntent.current = { key: requestKey, cacheOnly }
    const revision = ++sequence.current
    setResult(previous => ({ key: requestKey, revision: previous?.key === requestKey ? previous.revision : 0,
      data: previous?.key === requestKey ? previous.data : null, error: null, pending: true }))
    void loader(controller.signal, cacheOnly).then(data => {
      if (!controller.signal.aborted) setResult(previous => ({ key: requestKey, revision,
        data: data ?? (previous?.key === requestKey ? previous.data : null), error: null, pending: false }))
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult(previous => ({ key: requestKey,
        revision: previous?.key === requestKey ? previous.revision : 0,
        data: previous?.key === requestKey ? previous.data : null, pending: false,
        error: error instanceof Error ? error : new Error('Analysis unavailable') }))
    }).finally(() => {
      if (active.current?.controller === controller) active.current = null
    })
  }, [])
  useEffect(() => {
    return () => {
      if (active.current?.key === key) {
        active.current.controller.abort()
        active.current = null
      }
    }
  }, [key])
  useEffect(() => {
    if (enabled) run(key, load, true)
  }, [key, load, enabled, run])
  const current = result?.key === key ? result : null
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    pending: current?.pending ?? false,
    revision: `${key}:${current?.revision ?? 0}`,
    generate: () => run(key, load, false),
    generateFor: (requestKey: string, loader: Loader) => run(requestKey, loader, false),
    checkSaved: () => run(key, load, true),
    retry: () => run(key, load, lastIntent.current.key === key ? lastIntent.current.cacheOnly : false),
  }
}
