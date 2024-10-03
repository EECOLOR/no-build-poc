import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'

/**
 * @template T
 * @param {({ pathname: string } | { pathnameSignal: Signal<string> }) &
 *   { events: Array<string>, initialValue?: T }
 * } params
 * @returns
 */
export function useEventSourceAsSignal(params) {
  const { events, initialValue = null } = params

  const pathIsSignal = 'pathnameSignal' in params

  const [$signal, setValue] = createSignal(initialValue)

  const pathname = pathIsSignal ? params.pathnameSignal.get() : params.pathname
  let eventSource = createEventSource(pathname, events, setValue)

  const unsubscribe = pathIsSignal && params.pathnameSignal.subscribe(pathname => {
    eventSource.close()
    eventSource = createEventSource(pathname, events, setValue)
  })

  useOnDestroy(() => {
    if (unsubscribe) unsubscribe()
    eventSource.close()
  })

  return $signal
}

function createEventSource(pathname, events, callback) {
  const eventSource = new EventSource(pathname)
  for (const event of events) {
    eventSource.addEventListener(event, e => {
      callback({ event, data: JSON.parse(e.data) })
    })
  }
  return eventSource
}
