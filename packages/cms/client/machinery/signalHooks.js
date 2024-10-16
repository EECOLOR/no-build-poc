import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useCombined(...signals) {
  const [$combined, setCombined] = createSignal(() => signals.map(signal => signal.get()))

  const subscriptions = []
  for (const [i, signal] of signals.entries()) {
    const unsubscribe = signal.subscribeDirect(value => {
      setCombined(previous => {
        const newValue = previous.slice()
        newValue[i] = value
        return newValue
      })
    })

    subscriptions.push(unsubscribe)
  }

  useOnDestroy(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
  })

  return $combined
}

export function useSubscriptions(...subscriptions) {
  useOnDestroy(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
  })
}
