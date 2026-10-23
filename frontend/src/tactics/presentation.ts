import type { Scenario } from '../replay/types'
import type { Evidence, Layer, TacticalMoment } from './types'

export const evidenceLayer: Record<Evidence['category'], Layer> = {
  movement: 'movement', relationships: 'relationships', corridor: 'passing', space: 'space', finish: 'passing',
}
export const layerNames: Record<Layer, string> = { passing: 'Passing lanes', movement: 'Defensive movement', space: 'Space & coverage', relationships: 'Player relationships' }
export function formatMetric(metric: Evidence['metrics'][number]) {
  return `${metric.value} ${metric.unit}`
}
export function presentEvidence(e: Evidence, scenario: Scenario) {
  const names = e.playerIds.map(id => scenario.players.find(p => p.id === id)?.name ?? id)
  const metric = (name: string) => e.metrics.find(m => m.name === name)?.value
  const who = names[0] ?? 'The player'
  switch (e.category) {
    case 'movement': return { title: `Watch ${who.split(' ').at(-1)} move`, icon: '↗', sentence: `${who} follows the highlighted route over ${e.start.toFixed(1)}–${e.end.toFixed(1)} seconds. The line traces recorded movement.` }
    case 'relationships': {
      const change = metric('Separation change')
      return { title: change !== undefined && change < -.05 ? 'See the gap narrow' : change !== undefined && change > .05 ? 'See the players move apart' : 'Watch the distance between them', icon: '↔', sentence: `${names.join(' and ')} ${change !== undefined && change < -.05 ? 'move closer together' : change !== undefined && change > .05 ? 'move farther apart' : 'are linked by their measured separation'} during this interval.` }
    }
    case 'corridor': {
      const start = metric('Start clearance'), end = metric('Later clearance'), actual = metric('Moving ball clearance')
      return { title: actual !== undefined ? 'Follow the recorded pass' : 'See the passing route', icon: '⇢', sentence: actual !== undefined ? `The pass travels between the highlighted players. The nearest moving defender stays ${actual.toFixed(2)} m from the ball’s tracking centre.` : start !== undefined && end !== undefined ? `The measured route becomes ${end > start + .01 ? 'more open' : end < start - .01 ? 'narrower' : 'similar in clearance'} between these snapshots. This is a proposed route, not a recorded pass.` : 'The diagram marks the measured passing corridor. Clearance alone does not predict a successful pass.' }
    }
    case 'space': {
      const count = metric('Defenders within radius'), radius = metric('Coverage radius')
      return { title: 'Who covers the receiving space?', icon: '◎', sentence: count !== undefined && radius !== undefined ? `${count} ${count === 1 ? 'defender is' : 'defenders are'} within ${radius} m of the receiving point at ${e.start.toFixed(1)} seconds. Watch the nearest cover as play develops.` : 'The ring marks the measured receiving region; the line connects its nearest defender.' }
    }
    case 'finish': return { title: scenario.events.some(event => event.type === 'goal') ? 'Follow the shot across goal' : 'See where the shot goes wide', icon: '◉', sentence: 'Follow the recorded ball path through the finish. Player reactions are illustrative; no save or contact is added.' }
  }
}

export function presentMoment(moment: TacticalMoment, scenario: Scenario) {
  const missed = scenario.events.some(e => e.type === 'miss')
  // Authored editorial copy follows the existing guide; it is never a new metric.
  const headlines: Record<string, string> = missed ? {
    shape: 'A compact defence, before the run', run: 'The wide run meets a dropping defence', reshape: 'Cover stays near the central channel', pass: 'A forward pass reaches Finch', receive: 'Finch receives with cover nearby', recovery: 'The gap closes before the shot', finish: 'The shot goes outside the post',
  } : {
    shape: 'The shape before the movement', run: 'Rowan runs wide as the defence shifts', reshape: 'The defence reshapes before the pass', pass: 'Linden finds the inside-right channel', receive: 'Voss receives with cover nearby', finish: 'Voss finishes across goal',
  }
  const happened: Record<string, string> = missed ? {
    shape: 'Rook starts near the wide lane while Stone provides central cover near Finch.',
    run: 'Quinn runs outside. Rook drops with the run while Ward remains near the central channel.',
    reshape: 'The defensive line drops, with Stone in central cover and Hart in front.',
    pass: 'Marr plays forward to Finch. The recorded pass reaches the space ahead of the back line.',
    receive: 'Finch controls the ball with Stone goal-side and Hart recovering behind him.',
    recovery: 'Stone moves closer to Finch before the shot. Ward stays nearby in cover.',
    finish: 'Finch shoots with defenders nearby. The ball crosses the goal line outside the post.',
  } : {
    shape: 'Rowan starts beside Mercer, with Voss central and Pike nearby in cover.',
    run: 'Rowan runs diagonally toward the wide channel as nearby defenders adjust their positions.',
    reshape: 'North is near the wide runner. Mercer recovers inside while Pike narrows in central cover.',
    pass: 'Linden plays through the inside-right channel to Voss, after the defensive shift.',
    receive: 'Voss controls the pass on the move and shoots after one settling touch. Pike and Mercer close from either side.',
    finish: 'Voss shoots across goal. The ball reaches the net beyond the goalkeeper’s reaction.',
  }
  const why: Record<string, string> = {
    shape: 'This gives the starting context for the run and the defenders’ later positions.',
    run: 'Watch the runner and nearby defenders before the forward pass.',
    reshape: 'These positions provide the context for the passing route that follows.',
    pass: 'The next recorded event is the receiver controlling the ball. Geometric clearance is not a prediction of success.',
    receive: 'The next movement shows how nearby cover changes before the shot.',
    recovery: 'The shot follows this recovery. The measurements do not establish that pressure caused the miss.',
    finish: 'The outcome is recorded in the scenario. The replay cannot establish an alternative outcome.',
  }
  return { title: headlines[moment.id] ?? moment.title, happened: happened[moment.id] ?? moment.interpretation, why: why[moment.id] ?? 'Watch the recorded sequence and compare the supporting measurements.' }
}

export function supportingInsights(facts: Evidence[], focus: TacticalMoment['focus']) {
  const primaryCategory = focus === 'corridor' ? 'corridor' : focus
  const primary = facts.find(e => e.category === primaryCategory)
  const movement = facts.find(e => e.category === 'movement')
  return [...new Set([primary, movement, facts.find(e => e.category === 'space'), facts.find(e => e.category === 'relationships')].filter((e): e is Evidence => !!e))].slice(0, 4)
}
