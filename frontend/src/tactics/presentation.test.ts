import { describe, expect, it } from 'vitest'
import { scenarios } from '../replay/scenario'
import type { TacticalMoment } from './types'
import { presentMoment } from './presentation'

function moment(id: string): TacticalMoment {
  return { id, title: 'Amari’s movement', interpretation: 'Amari advances while Bell holds position.',
    start: 0, end: 1, focus: 'corridor', playerIds: [], evidenceIds: [], movements: [], interpretationStatus: 'authored_interpretation' }
}

// Verbatim expectations captured from the audited baseline, including qualifications.
const existingCopy: [string, string, ReturnType<typeof presentMoment>][] = [
  [
    "the-invisible-run",
    "shape",
    {
      "title": "The shape before the movement",
      "happened": "Rowan starts beside Mercer, with Voss central and Pike nearby in cover.",
      "why": "This gives the starting context for the run and the defenders’ later positions."
    }
  ],
  [
    "the-invisible-run",
    "run",
    {
      "title": "Rowan runs wide as the defence shifts",
      "happened": "Rowan runs diagonally toward the wide channel as nearby defenders adjust their positions.",
      "why": "Watch the runner and nearby defenders before the forward pass."
    }
  ],
  [
    "the-invisible-run",
    "reshape",
    {
      "title": "The defence reshapes before the pass",
      "happened": "North is near the wide runner. Mercer recovers inside while Pike narrows in central cover.",
      "why": "These positions provide the context for the passing route that follows."
    }
  ],
  [
    "the-invisible-run",
    "pass",
    {
      "title": "Linden finds the inside-right channel",
      "happened": "Linden plays through the inside-right channel to Voss, after the defensive shift.",
      "why": "The next recorded event is the receiver controlling the ball. Geometric clearance is not a prediction of success."
    }
  ],
  [
    "the-invisible-run",
    "receive",
    {
      "title": "Voss receives with cover nearby",
      "happened": "Voss controls the pass on the move and shoots after one settling touch. Pike and Mercer close from either side.",
      "why": "The next movement shows how nearby cover changes before the shot."
    }
  ],
  [
    "the-invisible-run",
    "finish",
    {
      "title": "Voss finishes across goal",
      "happened": "Voss shoots across goal. The ball reaches the net beyond the goalkeeper’s reaction.",
      "why": "The outcome is recorded in the scenario. The replay cannot establish an alternative outcome."
    }
  ],
  [
    "the-missed-chance",
    "shape",
    {
      "title": "A compact defence, before the run",
      "happened": "Rook starts near the wide lane while Stone provides central cover near Finch.",
      "why": "This gives the starting context for the run and the defenders’ later positions."
    }
  ],
  [
    "the-missed-chance",
    "run",
    {
      "title": "The wide run meets a dropping defence",
      "happened": "Quinn runs outside. Rook drops with the run while Ward remains near the central channel.",
      "why": "Watch the runner and nearby defenders before the forward pass."
    }
  ],
  [
    "the-missed-chance",
    "reshape",
    {
      "title": "Cover stays near the central channel",
      "happened": "The defensive line drops, with Stone in central cover and Hart in front.",
      "why": "These positions provide the context for the passing route that follows."
    }
  ],
  [
    "the-missed-chance",
    "pass",
    {
      "title": "A forward pass reaches Finch",
      "happened": "Marr plays forward to Finch. The recorded pass reaches the space ahead of the back line.",
      "why": "The next recorded event is the receiver controlling the ball. Geometric clearance is not a prediction of success."
    }
  ],
  [
    "the-missed-chance",
    "receive",
    {
      "title": "Finch receives with cover nearby",
      "happened": "Finch controls the ball with Stone goal-side and Hart recovering behind him.",
      "why": "The next movement shows how nearby cover changes before the shot."
    }
  ],
  [
    "the-missed-chance",
    "recovery",
    {
      "title": "The gap closes before the shot",
      "happened": "Stone moves closer to Finch before the shot. Ward stays nearby in cover.",
      "why": "The shot follows this recovery. The measurements do not establish that pressure caused the miss."
    }
  ],
  [
    "the-missed-chance",
    "finish",
    {
      "title": "The shot goes outside the post",
      "happened": "Finch shoots with defenders nearby. The ball crosses the goal line outside the post.",
      "why": "The outcome is recorded in the scenario. The replay cannot establish an alternative outcome."
    }
  ]
]

describe('scenario-scoped authored tactical copy', () => {
  it.each(existingCopy)('preserves %s / %s wording and qualifications', (id, key, expected) => {
    expect(presentMoment(moment(key), scenarios.find(s => s.id === id)!)).toEqual(expected)
  })
  it.each(['goal', 'miss'] as const)('uses a fictional third scenario’s own copy for a %s outcome and reused IDs', outcome => {
    const third = structuredClone(scenarios[outcome === 'goal' ? 0 : 1])
    third.id = 'fictional-third'
    third.players.forEach((player, i) => { player.name = `Amari Bell ${i}` })
    for (const key of ['shape', 'run', 'reshape', 'pass', 'receive', 'recovery', 'finish']) {
      const authored = moment(key), copy = presentMoment(authored, third)
      expect(copy).toEqual({ title: authored.title, happened: authored.interpretation, why: 'Watch the recorded sequence and compare the supporting measurements.' })
      for (const scenario of scenarios) for (const player of scenario.players) {
        expect(JSON.stringify(copy)).not.toContain(player.name.split(' ').at(-1))
      }
    }
  })
  it.each(scenarios)('uses supplied copy for unknown moment IDs in $id', scenario => {
    for (const id of ['unregistered-moment', 'constructor', '__proto__']) {
      const authored = moment(id)
      expect(presentMoment(authored, scenario)).toEqual({ title: authored.title, happened: authored.interpretation, why: 'Watch the recorded sequence and compare the supporting measurements.' })
    }
  })
  it('scopes copy to identity even when an existing scenario’s outcome changes', () => {
    const scenario = structuredClone(scenarios[0])
    scenario.events.find(e => e.type === 'goal')!.type = 'miss'
    expect(presentMoment(moment('run'), scenario)).toEqual(existingCopy.find(([id, key]) => id === scenario.id && key === 'run')![2])
  })
})
