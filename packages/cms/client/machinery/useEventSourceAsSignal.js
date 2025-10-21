import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { context } from '../context.js'

/**
 * @template T
 * @typedef {{ event: string, data: T }} Event
 */

/**
 * @template const T
 * @template const I
 * @arg {({ args: any[] } | { argsSignal: Signal<any[]> }) &
 *   { channel: string, events: Array<string>, initialValue: I, info?: any, type: T }
 * } params
 * @returns {Signal<I | Event<T>>}
 */
export function useEventSourceAsSignal(params) {
  const { channel, events, initialValue = null, info = null } = params

  const argsIsSignal = 'argsSignal' in params

  const [$signal, setValue] = createSignal(/** @type {I | Event<T>} */ (initialValue))

  const args = argsIsSignal ? params.argsSignal.get() : params.args
  let unsubscribeEvents = context.events.subscribe(channel, args, info, events, setValue)

  const unsubscribeSignal = argsIsSignal && params.argsSignal.subscribe(args => {
    unsubscribeEvents()
    unsubscribeEvents = context.events.subscribe(channel, args, info, events, setValue)
  })

  useOnDestroy(() => {
    if (unsubscribeSignal) unsubscribeSignal()
    unsubscribeEvents()
  })

  return $signal
}

