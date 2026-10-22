import { useEffect, useState } from 'react'
import type { components } from './api/schema'

type Connection = 'checking' | 'connected' | 'offline'
const apiUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

export function ApiConnection() {
  const [connection, setConnection] = useState<Connection>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    let active = true
    async function checkHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`, { signal: controller.signal })
        if (!response.ok) throw new Error('Health request failed')
        const data: components['schemas']['HealthResponse'] = await response.json()
        if (data.status !== 'ok' || data.project !== 'butterfly-effect') {
          throw new Error('Unexpected health response')
        }
        if (active) setConnection('connected')
      } catch {
        if (active) setConnection('offline')
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void checkHealth()
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  return <div className="connection"><span role="status" className={`api-status ${connection}`}><i />{connection === 'connected' ? 'API connected' : connection === 'offline' ? 'API offline' : 'Connecting to API'}</span><button className="retry" disabled={connection === 'checking'} onClick={() => { setConnection('checking'); setAttempt(attempt + 1) }} aria-label="Recheck API connection">↻</button></div>
}
