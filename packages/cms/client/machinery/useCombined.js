import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useCombined(...signals) {
  const [$combined, setCombined] = createSignal(() => signals.map(signal => signal.get()))

  const unsubscribeCallbacks = []
  for (const [i, signal] of signals.entries()) {
    const unsubscribe = signal.subscribe(value => {
      setCombined(previous => {
        const newValue = previous.slice()
        newValue[i] = value
        return newValue
      })
    })

    unsubscribeCallbacks.push(unsubscribe)
  }

  useOnDestroy(() => {
    for (const callback of unsubscribeCallbacks) callback()
  })

  return $combined
}
