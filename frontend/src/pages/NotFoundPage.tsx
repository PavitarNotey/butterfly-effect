import { Link } from 'react-router'

export default function NotFoundPage({ message = 'This page is outside the lines.' }: { message?: string }) {
  return <main id="page-main" className="not-found site-container" tabIndex={-1}><p className="section-kicker">OFF THE PITCH / 404</p><h1>{message}</h1><p>Find your way back to the fixtures, stories and moments.</p><Link className="site-button primary" to="/">Back to the matchday →</Link></main>
}
