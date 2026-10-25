import { useEffect, useState } from 'react'

export type Resource<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: Error }

/** Key changes hide old data immediately; cleanup aborts abandoned route requests. */
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; attempt: number; resource: Resource<T> } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, attempt, resource: { status: 'ready', data } })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, attempt, resource: { status: 'error', error: error instanceof Error ? error : new Error('Unable to load competition data.') } })
    })
    return () => controller.abort()
  }, [key, load, attempt])
  const resource: Resource<T> = result?.key === key && result.attempt === attempt ? result.resource : { status: 'loading' }
  return { resource, retry: () => setAttempt(a => a + 1) }
}
