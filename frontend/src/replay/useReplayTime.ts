import { useEffect, useState } from 'react'
import { replayStore } from './store'

/** Display sample only: the same anchored clock used by the 3D frame, never a second timer. */
export function useReplayTime(store = replayStore) {
  const [time, setTime] = useState(() => store.getState().readTime())
  useEffect(() => {
    let frame = 0
    const update = () => setTime(store.getState().readTime())
    const unsubscribe = store.subscribe(update)
    function sample() {
      update()
      frame = requestAnimationFrame(sample)
    }
    frame = requestAnimationFrame(sample)
    return () => { unsubscribe(); cancelAnimationFrame(frame) }
  }, [store])
  return time
}
