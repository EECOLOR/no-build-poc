import { useOnDestroy, withOnDestroyCapture } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'

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

/**
   * @template X
   * @template Y
   * @param {Signal<X>} signal
   * @param {(value: X) => Signal<Y>} constructSignalHook
   * @returns {Signal<Y>}
   */
export function useDynamicSignalHook(signal, constructSignalHook) {
  // TODO: check this code, it seems to leave an additional connection open (could also be the fact that we opened too many connections and just reached the threshold)
  let capturedOnDestroyCallbacks = []
  let hookSignal = createSignalHook(signal.get())
  const [$result, setResult] = createSignal(() => hookSignal?.get())
  let hookSignalUnsubscribe = hookSignal?.subscribe(setResult)

  const unsubscribe = signal.subscribe(x => {
    if (hookSignalUnsubscribe) hookSignalUnsubscribe()
    hookSignal = createSignalHook(x)
    setResult(hookSignal?.get())
    hookSignalUnsubscribe = hookSignal?.subscribe(setResult)
  })

  useOnDestroy(() => {
    unsubscribe()
    if (hookSignalUnsubscribe) hookSignalUnsubscribe()
    callCapturedOnDestroyCallbacks()
  })

  return $result

  /** @param {X} value */
  function createSignalHook(value) {
    callCapturedOnDestroyCallbacks()
    const [result, callbacks] = withOnDestroyCapture(() => constructSignalHook(value))
    capturedOnDestroyCallbacks = callbacks
    return result
  }

  function callCapturedOnDestroyCallbacks() {
    for (const callback of capturedOnDestroyCallbacks) callback()
    capturedOnDestroyCallbacks.length = 0
  }
}
