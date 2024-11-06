import { createSignal } from '#ui/signal.js'
import { createAsyncTaskQueue } from './asyncTaskQueue.js'

/** @typedef {string} Key */
/** @typedef {string} Channel */
/** @typedef {any[]} Args */
/** @typedef {string} EventName */
/** @typedef {(event: EventName, data: any) => void} Callback */
/** @typedef {ReturnType<typeof createMessageBroker>} MessageBroker */

/**
 * @param {{ apiPath: string, onError(e:Error):void }} params
 */
export function createMessageBroker({ apiPath, onError }) {
  const [$connectId, setConnectId] = createSignal(null)
  const eventSource = createEventSource({ onConnectIdChange: setConnectId, onError })
  const serverQueue = createAsyncTaskQueue({ processTask, onError, })

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
     * @param {EventName} event
     * @param {Callback} callback
     */
    subscribe(channel, args, event, callback) {
      const unsubscribeFromEventSource = subscribeToEventSource(event, channel, args, callback)
      const unsubscribeFromServer = subscribeToServer(channel, args)

      return function unsubscribe() {
        unsubscribeFromEventSource()
        unsubscribeFromServer()
      }
    }
  }

  function createEventSource({ onConnectIdChange, onError }) {
    const pathname = `${apiPath}/events`
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
      console.log(`Connection to ${pathname} lost`)
    })
    return eventSource
  }

  function subscribeToEventSource(event, channel, args, callback) {
    const fullEventName = `${event}-${channel}-${args.join('|')}`
    eventSource.addEventListener(fullEventName, listener)

    return function unsubscribeFromEventSource() {
      eventSource.removeEventListener(fullEventName, listener)
    }

    function listener(e) {
      callback({ event, data: JSON.parse(e.data) })
    }
  }

  function subscribeToServer(channel, args) {
    const key = `${channel}-${args.join('|')}`

    const existingSubscription = serverSubscriptions.get(key)
    if (existingSubscription) {
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
      fetch(`${apiPath}/events/${action}`, {
        method: 'POST',
        headers: { 'X-connect-id': connectId },
        body: JSON.stringify({ channel, args }),
      })
    )
  }

  function processTask(callServer) {
    const connectId = $connectId.get()
    if (!connectId) return
    return callServer(connectId)
  }
}
