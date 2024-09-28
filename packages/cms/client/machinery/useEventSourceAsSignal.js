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

  if ('pathnameSignal' in params)
    return useEventSourceAsSignalWithPathSignal(params)

  const [$signal, setValue] = createSignal(initialValue)

  const eventSource = createEventSource(params.pathname, events, setValue)
  useOnDestroy(() => eventSource.close())

  return $signal
}

function useEventSourceAsSignalWithPathSignal({ pathnameSignal, events, initialValue = null }) {
  const [$signal, setValue] = createSignal(initialValue)

  const $eventSource = pathnameSignal.derive((pathname, previousEventSource) => {
    if (previousEventSource) previousEventSource.close()
    return createEventSource(pathname, events, setValue)
  })
  $eventSource.init()

  useOnDestroy(() => $eventSource.get().close())

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
