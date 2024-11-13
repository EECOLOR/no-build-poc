import { createSignal } from '#ui/signal.js'
import { createAsyncTaskQueue } from './asyncTaskQueue.js'

/** @typedef {string} Key */
/** @typedef {string} Channel */
/** @typedef {any[]} Args */
/** @typedef {string} EventName */
/** @typedef {(event: EventName, data: any) => void} Callback */
/** @typedef {ReturnType<typeof createMessageBroker>} MessageBroker */

/**
 * @param {{ api: import('../context.js').Context['api'], onError(e:Error):void }} params
 */
export function createMessageBroker({ api, onError }) {
  const [$connectId, setConnectId] = createSignal(null)
  const eventSource = createEventSource({ onConnectIdChange: setConnectId, onError })
  const serverQueue = createAsyncTaskQueue({ processTask, onError, })

  /** @type {Map<string, { listenerCount: number, event?: any }>} */
  const lastKnownEvents = new Map()

  /** @type {Map<Key, { count, channel, args }>} */
  const serverSubscriptions = new Map()

  $connectId.subscribe(_ => {
    for (const { channel, args } of serverSubscriptions.values())
      updateServerSubscription('subscribe', channel, args)
  })

  return {
    /**
     *
     * @param {Channel} channel
     * @param {Args} args
     * @param {Array<EventName>} events
     * @param {Callback} callback
     */
    subscribe(channel, args, events, callback) {
      const eventSourceSubscriptions = []
      for (const event of events)
        eventSourceSubscriptions.push(subscribeToEventSource(event, channel, args, callback))

      const unsubscribeFromServer = subscribeToServer(channel, args)

      return function unsubscribe() {
        for (const unsubscribe of eventSourceSubscriptions)
          unsubscribe()

        unsubscribeFromServer()
      }
    }
  }

  function createEventSource({ onConnectIdChange, onError }) {
    const pathname = api.events()
    const eventSource = new EventSource(pathname)
    window.addEventListener('beforeunload', _ => eventSource.close())
    eventSource.addEventListener('open', _ => {
      console.log(`Connection to ${pathname} established`)
    })
    eventSource.addEventListener('connect', e => {
      const connectId = JSON.parse(e.data)
      onConnectIdChange(connectId)
      console.log(`Obtained connect id "${connectId}"`)
    })
    eventSource.addEventListener('error', e => {
      onConnectIdChange(null)
      onError(e)
      console.log(`Connection to ${pathname} lost`)
    })
    return eventSource
  }

  function subscribeToEventSource(event, channel, args, callback) {
    const fullEventName = `${event}-${channel}-${args.join('|')}`

    const lastKnownEvent = prepareLastKnownEvent(fullEventName)
    addEventListener(lastKnownEvent, fullEventName)

    return function unsubscribeFromEventSource() {
      removeEventListener(lastKnownEvent, fullEventName)
    }

    function listener(e) {
      lastKnownEvent.event = e
      callback({ event, data: JSON.parse(e.data) })
    }

    function prepareLastKnownEvent(fullEventName) {
      if (!lastKnownEvents.has(fullEventName))
        lastKnownEvents.set(fullEventName, { listenerCount: 0 })

      return lastKnownEvents.get(fullEventName)
    }

    function addEventListener(lastKnownEvent, fullEventName) {
      lastKnownEvent.listenerCount += 1
      eventSource.addEventListener(fullEventName, listener)
      if (lastKnownEvent.event)
        listener(lastKnownEvent.event)
    }

    function removeEventListener(lastKnownEvent, fullEventName) {
      lastKnownEvent.listenerCount -= 1
      if (!lastKnownEvent.listenerCount)
        lastKnownEvents.delete(fullEventName)

      eventSource.removeEventListener(fullEventName, listener)
    }
  }

  function subscribeToServer(channel, args) {
    const key = `${channel}-${args.join('|')}`

    const existingSubscription = serverSubscriptions.get(key)
    if (existingSubscription) {
      // If you end up here because of the warning you might want the initial value to be sent for
      // each subscription, even if it is a double subscription. It is quite easy to do so by
      // modifying this code. The implications however are that every subscription will get that
      // initial value again, which is potentially bad for performance and might even cause
      // unexpected behavior.
      console.warn(`Warning: multiple subscriptions active for the same channel and args (${key}), you might want to share those subscriptions. Also note that the initial value is only sent for the first subscription. See code for more details.`)
      existingSubscription.count += 1
      return unsubscribeFromServer
    }

    serverSubscriptions.set(key, { count: 1, channel, args })
    updateServerSubscription('subscribe', channel, args)

    return unsubscribeFromServer

    function unsubscribeFromServer() {
      const subscription = serverSubscriptions.get(key)
      subscription.count -= 1
      if (subscription.count)
        return

      serverSubscriptions.delete(key)
      updateServerSubscription('unsubscribe', channel, args)
    }
  }

  function updateServerSubscription(action, channel, args) {
    serverQueue.add(connectId =>
      fetch(api.events.subscription({ action }), {
        method: 'POST',
        headers: { 'X-connect-id': connectId },
        body: JSON.stringify({ channel, args }),
      }).then(r => r.text() /* If we don't read the response, Chrome thinks we failed, also we might trigger an open pipe error */)
    )
  }

  function processTask(callServer) {
    const connectId = $connectId.get()
    if (!connectId) return
    return callServer(connectId)
  }
}
