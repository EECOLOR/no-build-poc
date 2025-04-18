import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { context } from '../context.js'

/**
 * @template T
 * @param {({ args: any[] } | { argsSignal: Signal<any[]> }) &
 *   { channel: string, events: Array<string>, initialValue?: T, info?: any }
 * } params
 * @returns {Signal<T | { event: string, data: any }>}
 */
export function useEventSourceAsSignal(params) {
  const { channel, events, initialValue = null, info = null } = params

  const argsIsSignal = 'argsSignal' in params

  const [$signal, setValue] = createSignal(initialValue)

  const args = argsIsSignal ? params.argsSignal.get() : params.args
  let unsubscribeEvents = subscribeToEvents(channel, args, info, events, setValue)

  const unsubscribeSignal = argsIsSignal && params.argsSignal.subscribe(args => {
    unsubscribeEvents()
    unsubscribeEvents = subscribeToEvents(channel, args, info, events, setValue)
  })

  useOnDestroy(() => {
    if (unsubscribeSignal) unsubscribeSignal()
    unsubscribeEvents()
  })

  return $signal
}

function subscribeToEvents(channel, args, info, events, callback) {
  return context.events.subscribe(channel, args, info, events, callback)
}
