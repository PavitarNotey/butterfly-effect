import type { Player, Scenario } from '../types'
import { samplePosition, sampleTravel, sampleYaw } from '../sample'
import { smooth } from './footballActions'

export interface FootballReaction {
  kind: 'keeper-dive' | 'keeper-track' | 'celebrate' | 'disappointed' | 'defend'
  elapsed: number; weight: number; side: number; look: number
  trackingStride?: number
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
const windows = new WeakMap<Scenario, { shot: Scenario['events'][number]; outcome: Scenario['events'][number]; shooter: Player } | null>()
function shotWindow(s: Scenario) {
  if (!windows.has(s)) {
    const shot = s.events.find(e => e.type === 'shot'), outcome = s.events.find(e => e.type === 'goal' || e.type === 'miss')
    const shooter = shot && s.players.find(p => p.id === shot.playerIds.find(id => s.players.find(p => p.id === id)?.role !== 'Goalkeeper'))
    windows.set(s, shot && outcome && shooter ? { shot, outcome, shooter } : null)
  }
  return windows.get(s)!
}
/** Event-linked presentation only: no writes to roots, tracks, ball or evidence. */
export function sampleReaction(s: Scenario, p: Player, t: number): FootballReaction | null {
  const sequence = shotWindow(s)
  if (!sequence) return null
  const { shot, outcome, shooter } = sequence
  const pos = samplePosition(p.positions,t), ball = samplePosition(s.ball,t), yaw = sampleYaw(p.facing,t)
  const look = clamp(Math.atan2(Math.sin(Math.atan2(ball[0]-pos[0],ball[2]-pos[2])-yaw),Math.cos(Math.atan2(ball[0]-pos[0],ball[2]-pos[2])-yaw)), -.85,.85)
  if (p.role === 'Goalkeeper' && p.teamId !== shooter.teamId) {
    const elapsed = t - shot.t
    const weight = smooth(-.9,-.3,elapsed) * (1-smooth(2.1,3.0,elapsed))
    if (weight <= 0) return null
    const end = samplePosition(s.ball,outcome.t), release = samplePosition(p.positions,shot.t), heading = sampleYaw(p.facing,shot.t)
    const side = Math.sign((end[0]-release[0])*Math.cos(heading)-(end[2]-release[2])*Math.sin(heading)) || 1
    return { kind: outcome.type === 'goal' ? 'keeper-dive' : 'keeper-track', elapsed, weight, side, look, trackingStride: s.id === 'the-missed-chance' ? sampleTravel(p.positions, t) * Math.PI * 2 / 1.1 : undefined }
  }
  if (p.id === shooter.id) {
    const elapsed = t - outcome.t
    const goal = outcome.type === 'goal'
    const weight = smooth(.18,.75,elapsed) * (1-smooth(goal ? 3.0 : 1.45,goal ? 4.6 : 2.3,elapsed))
    return weight > 0 ? { kind: goal ? 'celebrate' : 'disappointed', elapsed, weight, side: 1, look } : null
  }
  if (outcome.type === 'goal') {
    const atGoal = samplePosition(p.positions,outcome.t), scorer = samplePosition(shooter.positions,outcome.t)
    const nearby = 1-smooth(16,28,Math.hypot(atGoal[0]-scorer[0],atGoal[2]-scorer[2]))
    const elapsed = t-outcome.t
    // Let the existing defensive brace fade out before a conceded-goal gesture.
    const onset = elapsed - (p.teamId === shooter.teamId ? 0 : 1.1)
    const weight = nearby * .65 * smooth(.4,1.0,onset) * (1-smooth(3.2,4.8,elapsed))
    if (weight > 0 && p.role !== 'Goalkeeper') return { kind: p.teamId === shooter.teamId ? 'celebrate' : 'disappointed',elapsed,weight,side:1,look }
  }
  if (p.teamId !== shooter.teamId && p.role !== 'Goalkeeper') {
    const distance = Math.hypot(ball[0]-pos[0],ball[2]-pos[2])
    const weight = (1-smooth(12,25,distance)) * smooth(0,.5,t) * (1-smooth(outcome.t+.2,outcome.t+1.5,t))
    if (weight > 0) return { kind:'defend',elapsed:t-shot.t,weight,side:1,look }
  }
  return null
}
