import { analysisErrorMessage } from './presentation'

export function AnalysisMotif() {
  return <svg className="ai-motif" viewBox="0 0 260 70" aria-hidden="true"><path d="M1 62V8h258v54H1Zm129-54v54M1 35h258" fill="none" stroke="currentColor" opacity=".2" /><path d="m30 48 66-28 64 29 70-30" fill="none" stroke="currentColor" strokeDasharray="4 5" /><circle cx="30" cy="48" r="5" /><circle cx="96" cy="20" r="5" /><circle cx="160" cy="49" r="5" /><circle cx="230" cy="19" r="6" /></svg>
}

export function AnalysisLoading({ refreshing = false }: { refreshing?: boolean }) {
  return <div className="ai-processing" role="status"><span className="ai-sweep" aria-hidden="true" /><span className="ai-processing-markers" aria-hidden="true"><i /><i /><i /></span><p>{refreshing ? 'Refreshing your analysis…' : 'Preparing your football analysis…'}</p></div>
}

export function AnalysisError({ error, retained, retry }: { error: Error; retained: boolean; retry: () => void }) {
  return <div className="ai-error" role="alert"><p>{analysisErrorMessage(error)}{retained ? ' Your previous analysis is still here.' : ''}</p><button onClick={retry}>Retry analysis</button></div>
}

