/** @typedef {ReturnType<typeof createStreams>} Streams */

import { noContent, notFound } from './response.js'

export function createStreams() {

  const streams = {}

  return {
    connect(res) {
      const connectId = crypto.randomUUID()
      res.addListener('close', _ => cleanup(connectId))
      res.addListener('error', _ => cleanup(connectId))

      streams[connectId] = { res, cleanupCallbacks: new Set() }

      startEventStream(res)
      sendEvent(res, 'connect', connectId)
    },
    addListener(connectId, listeners, cleanup) {
      listeners.add(connectId)

      streams[connectId].cleanupCallbacks.add(remove)

      function remove() {
        listeners.delete(connectId)
        if (!listeners.size) cleanup()
      }
    },
    removeListener(connectId, listeners, cleanup) {
      listeners.delete(connectId)
      if (!listeners.size) cleanup()
    },
    sendEvent(connectId, event, data) {
      sendEvent(streams[connectId].res, event, data)
    },
    isValid(connectId) {
      return Boolean(streams[connectId])
    },
  }

  function cleanup(connectId) {
    if (!streams[connectId]) return

    for (const cleanup of streams[connectId].cleanupCallbacks)
      cleanup()

    delete streams[connectId]
  }
}

/**
 * @template {readonly string[]} X
 * @typedef {{
 *   subscribe(connectId: string, args: X): void
 *   unsubscribe(connectId: string, args: X): void
 *   notify(...args: X): void
 *   isValid(connectId: string): boolean
 * }} StreamCollection
 */

/**
 * @template {readonly string[]} X
 * @template Y
 * @param {{
 *   getChannel(args: X): string
 *   getData(...args: X): Y,
 *   eventName: string,
 *   streams: Streams
 * }} props
 */
 export function createEventStreamCollection({ getChannel, getData, eventName, streams }) {
  const collection = createCustomEventStreamCollection({
    getChannel,
    createInitialValue: noValue,
    notifyEvent: eventName,
    subscribeEvent: eventName,
    getSubscribeData,
    streams,
  })

  return {
    /** @param {X} args */
    subscribe(connectId, args) {
      collection.subscribe(connectId, args)
    },

    /** @param {X} args */
    unsubscribe(connectId, args) {
      collection.unsubscribe(connectId, args)
    },

    /** @param {X} args */
    notify(...args) {
      collection.notify(getData(...args), args)
    },

    isValid(connectId) {
      return collection.isValid(connectId)
    },
  }

  /** @param {X} args */
  function noValue(...args) {
    return null
  }

  /** @param {X} args */
  function getSubscribeData(_, args) {
    return getData(...args)
  }
}

/**
 * @template {readonly string[]} T
 * @param {StreamCollection<T>} eventStreams */
export function handleSubscription(res, eventStreams, method, connectId, args) {
  if (!eventStreams.isValid(connectId))
    return notFound(res)

  if (method === 'HEAD')
    eventStreams.subscribe(connectId, args)
  else if (method === 'DELETE')
    eventStreams.unsubscribe(connectId, args)

  noContent(res)
}

/**
 * @template {readonly string[]} X
 * @template Y
 * @param {{
 *   getChannel(args: X): string
 *   createInitialValue(...args: X): Y
 *   subscribeEvent: string
 *   getSubscribeData(value: Y, args: X): any
 *   notifyEvent: string
 *   streams: Streams
 * }} props
 */
export function createCustomEventStreamCollection({
  getChannel,
  createInitialValue,
  subscribeEvent,
  getSubscribeData,
  notifyEvent,
  streams,
}) {
  const collection = {}

  return {
    /** @param {X} args */
    subscribe(connectId, args) {
      const { value, listeners } = createOrGetAt(() => createValue(...args), collection, args)
      streams.addListener(connectId, listeners, function cleanup() {
        deleteAt(collection, args)
      })
      streams.sendEvent(connectId, event(subscribeEvent, args), getSubscribeData(value, args))
    },

    /** @param {X} args */
    unsubscribe(connectId, args) {
      const info = getAt(collection, args)
      if (!info)
        return

      streams.removeListener(connectId, info.listeners, function cleanup() {
        deleteAt(collection, args)
      })
    },

    /** @param {X} args */
    notify(data, args) {
      const info = getAt(collection, args)
      if (!info)
        return

      for (const connectId of info.listeners)
        streams.sendEvent(connectId, event(notifyEvent, args), data)
    },

    isValid(connectId) {
      return streams.isValid(connectId)
    },

    /** @param {X} args */
    getValue(...args) {
      return getAt(collection, args)?.value
    },
  }

  /** @param {X} args */
  function event(base, args) {
    return `${base}-${getChannel(args)}`
  }

  /** @param {X} args */
  function createValue(...args) {
    return {
      listeners: new Set(),
      value: createInitialValue(...args)
    }
  }
}

export function startEventStream(res) {
  res.writeHead(200, {
    'X-Accel-Buffering': 'no',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  })
}

export function sendEvent(res, event, data) {
  res.write(
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n` +
    `\n`
  )
}

function createOrGetAt(createValue, o, keys) {
  if (!keys.length) keys = ['default']
  return keys.reduce(
    (result, key, i) => {
      if (key in result)
        return result[key]

      const isLast = i === keys.length - 1
      return result[key] = isLast ? createValue() : {}
    },
    o
  )
}

function getAt(o, keys) {
  if (!keys.length) keys = ['default']
  return keys.reduce((result, key) => result && result[key], o)
}

function deleteAt(o, keys) {
  if (!keys.length) keys = ['default']
  let target = o
  for (const [i, key] of keys.entries()) {
    if (!target) return

    const isLast = i === keys.length - 1
    if (isLast) delete target[key]
    else target = target[key]
  }
}
