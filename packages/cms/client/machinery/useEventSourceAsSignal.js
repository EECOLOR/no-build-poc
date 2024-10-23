import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { context } from '../context.js'

let eventSource = null
let subscriptionCounter = 0
let connectId = Promise.withResolvers()

function subscribeToEventSource(event, callback) {
  console.log('subscribe to', event)
  if (!eventSource) {
    eventSource = new EventSource(`${context.apiPath}/events`)
    eventSource.addEventListener('connect', e => {
      connectId.resolve(JSON.parse(e.data))
    })
    eventSource.addEventListener('error', e => {
      connectId.reject(`Error connecting to event source`)
    })
  }

  subscriptionCounter += 1
  eventSource.addEventListener(event, callback)

  return function unsubscribe() {
    eventSource.removeEventListener(event, callback)
    subscriptionCounter -= 1

    if (!subscriptionCounter) {
      eventSource.close()
      eventSource = null
      connectId = Promise.withResolvers()
    }
  }
}

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
  for (const event of events) {
    subscriptions.push(
      subscribeToEventSource(`${event}-${pathname}`, e => {
        callback({ event, data: JSON.parse(e.data) })
      })
    )
  }

  const subscribeUrl = `${context.apiPath}/${pathname}`
  connectId.promise
    .then(connectId =>
      fetch(subscribeUrl, { method: 'HEAD', headers: subscribeHeaders(connectId) }) // TODO: cancel on unsubscribe
    )
    .catch(e => console.error(e)) // TODO: error handling

  return function unsubscribe() {
    for (const unsubscribe of subscriptions) unsubscribe()

    connectId.promise
      .then(connectId =>
        fetch(subscribeUrl, { method: 'DELETE', headers: subscribeHeaders(connectId) })
      )
      .catch(e => console.error(e)) // TODO: error handling
  }
}

function subscribeHeaders(connectId) {
  return { 'X-connect-id': connectId }
}
