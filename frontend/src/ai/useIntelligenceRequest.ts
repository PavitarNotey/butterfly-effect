import { useEffect, useState } from 'react'
import type { Intelligence } from './client'

interface Result {
  key: string
  attempt: number
  revision: number
  data: Intelligence | null
  error: Error | null
}

/** Retain successful content only for this exact match/mode during a refresh. */
export function useIntelligenceRequest(key: string, load: (signal: AbortSignal) => Promise<Intelligence>, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let active = true
    void load(controller.signal).then(data => {
      if (active && !controller.signal.aborted) setResult({ key, attempt, revision: attempt, data, error: null })
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) setResult(previous => ({ key, attempt,
        data: previous?.key === key ? previous.data : null,
        revision: previous?.key === key ? previous.revision : 0,
        error: error instanceof Error ? error : new Error('Analysis unavailable'),
      }))
    })
    return () => { active = false; controller.abort() }
  }, [key, load, enabled, attempt])
  const current = result?.key === key ? result : null
  return {
    data: current?.data ?? null,
    error: current?.attempt === attempt ? current.error : null,
    pending: enabled && current?.attempt !== attempt,
    revision: `${key}:${current?.revision ?? 0}`,
    refresh: () => setAttempt(a => a + 1),
  }
}
