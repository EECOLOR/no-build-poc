import { createSignal } from '#ui/signal.js'
import { createAsyncTaskQueue } from './asyncTaskQueue.js'

/** @typedef {string} Pathname */
/** @typedef {string} EventName */
/** @typedef {(event: EventName, data: any) => void} Callback */
/** @typedef {number} ConnectionCount */
/** @typedef {ReturnType<typeof createMessageBroker>} MessageBroker */

/**
 * @param {{ apiPath: string, onError(e:Error):void }} params
 */
export function createMessageBroker({ apiPath, onError }) {
  const [$connectId, setConnectId] = createSignal(null)
  const eventSource = createEventSource({ onConnectIdChange: setConnectId, onError })
  const serverQueue = createAsyncTaskQueue({ processTask, onError, })

  /** @type {Map<Pathname, ConnectionCount>} */
  const serverSubscriptions = new Map()

  $connectId.subscribe(_ => {
    for (const pathname of serverSubscriptions.keys())
      updateServerSubscription('subscribe', pathname)
  })

  return {
    /**
     *
     * @param {Pathname} pathname
     * @param {EventName} event
     * @param {Callback} callback
     */
    subscribe(pathname, event, callback) {
      const unsubscribeFromEventSource = subscribeToEventSource(pathname, event, callback)
      const unsubscribeFromServer = subscribeToServer(pathname)

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

  function subscribeToEventSource(pathname, event, callback) {
    const fullEventName = `${event}-${pathname}`
    eventSource.addEventListener(fullEventName, listener)

    return function unsubscribeFromEventSource() {
      eventSource.removeEventListener(fullEventName, listener)
    }

    function listener(e) {
      callback({ event, data: JSON.parse(e.data) })
    }
  }

  function subscribeToServer(pathname) {
    const count = serverSubscriptions.get(pathname) || 0
    serverSubscriptions.set(pathname, count + 1)

    if (count)
      return unsubscribeFromServer

    updateServerSubscription('subscribe', pathname)

    return unsubscribeFromServer

    function unsubscribeFromServer() {
      const count = serverSubscriptions.get(pathname)
      const newCount = count - 1
      if (newCount)
        serverSubscriptions.set(pathname, newCount)
      else {
        serverSubscriptions.delete(pathname)
        updateServerSubscription('unsubscribe', pathname)
      }
    }
  }

  function updateServerSubscription(action, pathname) {
    serverQueue.add(connectId =>
      fetch(`${apiPath}/${pathname}/subscription`, {
        method: action === 'subscribe' ? 'HEAD' : 'DELETE',
        headers: { 'X-connect-id': connectId }
      })
    )
  }

  function processTask(callServer) {
    const connectId = $connectId.get()
    if (!connectId) return
    return callServer(connectId)
  }
}
