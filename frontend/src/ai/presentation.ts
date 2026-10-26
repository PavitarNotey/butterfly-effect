import type { Intelligence } from './client'

export function analysisErrorMessage(error: Error) {
  if (/quota|rate|limit/i.test(error.message)) return 'Analysis is at its request limit. Try again shortly.'
  if (/timed|too long/i.test(error.message)) return 'Analysis is taking too long. Try again.'
  if (/configuration|disabled|credentials|deployment|access/i.test(error.message)) return 'AI analysis is unavailable right now. Try again later.'
  return 'Analysis could not be loaded. Check the connection and try again.'
}

export function analysisState(data: Intelligence | null, pending: boolean, error: Error | null) {
  return pending ? 'loading' : error ? 'error' : data?.provider === 'validation_fallback' ? 'fallback' : data ? 'ready' : 'idle'
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
export function narrativeSentences(text: string) {
  return Array.from(segmenter.segment(text), part => part.segment)
}
