import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { context } from '../context.js'

/** @typedef {string} Pathname */
/** @typedef {string} EventName */
/** @typedef {(event: EventName, data: any) => void} Callback */
/** @typedef {number} ConnectionCount */
/** @typedef {ReturnType<typeof createMessageBroker>} MessageBroker */

// TODO: move to another file (and remove dependency of context)
/**
 * @param {{ onError(e:Error):void }} params
 */
export function createMessageBroker({ onError }) {
  const [$connectId, setConnectId] = createSignal(null)
  const eventSource = createEventSource({ onConnect: setConnectId, onError })
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

  function createEventSource({ onConnect, onError }) {
    const eventSource = new EventSource(`${context.apiPath}/events`)
    eventSource.addEventListener('connect', e => {
      onConnect(JSON.parse(e.data))
    })
    eventSource.addEventListener('error', onError)
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
      fetch(`${context.apiPath}/${pathname}/subscription`, {
        method: action === 'subscribe' ? 'HEAD' : 'DELETE',
        headers: subscribeHeaders(connectId)
      })
    )
  }

  function processTask(callServer) {
    const connectId = $connectId.get()
    if (!connectId) return
    return callServer(connectId)
  }
}

/**
 * @template T
 * @param {{
 *   processTask(task: T): Promise<void>
 *   onError(e: Error): void
 * }} params
 */
function createAsyncTaskQueue({ processTask, onError }) {
  /** @type {Array<T>} */
  const queue = []
  let isStarted = false

  return {
    /** @param {T} task */
    add(task) {
      queue.push(task)
      if (!isStarted) start()
    }
  }

  function start() {
    isStarted = true
    nextTask()
  }

  function stop() {
    isStarted = false
  }

  function nextTask() {
    const task = queue.shift()
    const result = processTask(task)

    if (result)
      result.finally(nextTaskOrStop).catch(onError)
    else
      nextTaskOrStop()
  }

  function nextTaskOrStop() {
    if (queue.length)
      nextTask()
    else
      stop()
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
  for (const event of events)
    subscriptions.push(context.events.subscribe(pathname, event, callback))

  return function unsubscribe() {
    for (const unsubscribe of subscriptions)
      unsubscribe()
  }
}

function subscribeHeaders(connectId) {
  return { 'X-connect-id': connectId }
}
