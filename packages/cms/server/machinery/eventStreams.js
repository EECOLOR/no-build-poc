
/**
 * @template {readonly [string, ...string[]]} X
 * @template Y
 * @param {{ getData(...args: X): Y, eventName: string }} props
 */
 export function createEventStreamCollection({ getData, eventName }) {
  const collection = createCustomEventStreamCollection({
    createInitialValue: noValue,
    notifyEvent: eventName,
    subscribeEvent: eventName,
    getSubscribeData,
  })

  return {
    /** @param {X} args */
    subscribe(res, args) {
      collection.subscribe(res, args)
    },

    /** @param {X} args */
    notify(...args) {
      collection.notify(getData(...args), args)
    }
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
 * @template {readonly [string, ...string[]]} X
 * @template Y
 * @param {{
 *   createInitialValue(...args: X): Y
 *   subscribeEvent: string
 *   getSubscribeData(value: Y, args: X): any
 *   notifyEvent: string
 * }} props
 */
export function createCustomEventStreamCollection({
  createInitialValue,
  subscribeEvent,
  getSubscribeData,
  notifyEvent,
}) {
  const collection = {}

  return {
    /** @param {X} args */
    subscribe(res, args) {
      const { value, listeners } = createOrGetAt(() => createValue(...args), collection, args)
      addListener(res, listeners, function cleanup() {
        deleteAt(collection, args)
      })
      startEventStream(res)
      sendEvent(res, subscribeEvent, getSubscribeData(value, args))
    },

    /** @param {X} args */
    notify(data, args) {
      const info = getAt(collection, args)
      if (!info)
        return

      for (const res of info.listeners)
        sendEvent(res, notifyEvent, data)
    },

    /** @param {X} args */
    getValue(...args) {
      return getAt(collection, args)?.value
    }
  }

  /** @param {X} args */
  function createValue(...args) {
    return {
      listeners: new Set(),
      value: createInitialValue(...args)
    }
  }
}

function startEventStream(res) {
  res.writeHead(200, {
    'X-Accel-Buffering': 'no',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  })
}

function addListener(res, target, cleanup = undefined) {
  target.add(res)
  res.addListener('close', remove)
  res.addListener('error', remove)

  function remove() {
    target.delete(res)
    if (cleanup && !target.size) cleanup()
  }
}

function sendEvent(res, event, data) {
  res.write(
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n` +
    `\n`
  )
}

function createOrGetAt(createValue, o, keys) {
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
  return keys.reduce((result, key) => result && result[key], o)
}

function deleteAt(o, keys) {
  let target = o
  for (const [i, key] of keys.entries()) {
    if (!target) return

    const isLast = i === keys.length - 1
    if (isLast) delete target[key]
    else target = target[key]
  }
}
