import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

export function useEventSourceAsSignal({ pathname, events }) {
  const [$signal, setValue] = createSignal(null)
  const eventSource = new EventSource(pathname)
  for (const event of events) {
    eventSource.addEventListener(event, e => {
      setValue({ event, data: JSON.parse(e.data) })
    })
  }
  useOnDestroy(eventSource.close.bind(eventSource))

  return $signal
}
