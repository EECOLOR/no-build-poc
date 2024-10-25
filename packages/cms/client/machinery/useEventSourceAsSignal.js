import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { context } from '../context.js'

/**
 * @template T
 * @param {({ pathname: string } | { pathnameSignal: Signal<string> }) &
 *   { events: Array<string>, initialValue?: T }
 * } params
 * @returns {Signal<T | { event: string, data: any }>}
 */
export function useEventSourceAsSignal(params) {
  const { events, initialValue = null } = params

  const pathIsSignal = 'pathnameSignal' in params

  const [$signal, setValue] = createSignal(initialValue)

  const pathname = pathIsSignal ? params.pathnameSignal.get() : params.pathname
  let unsubscribeEvents = subscribeToEvents(pathname, events, setValue)

  const unsubscribeSignal = pathIsSignal && params.pathnameSignal.subscribe(pathname => {
    unsubscribeEvents()
    unsubscribeEvents = subscribeToEvents(pathname, events, setValue)
  })

  useOnDestroy(() => {
    if (unsubscribeSignal) unsubscribeSignal()
    unsubscribeEvents()
  })

  return $signal
}

function subscribeToEvents(pathname, events, callback) {
  const subscriptions = []
  for (const event of events)
    subscriptions.push(context.events.subscribe(pathname, event, callback))

  return function unsubscribe() {
    for (const unsubscribe of subscriptions)
      unsubscribe()
  }
}
