import { spawn } from 'node:child_process'

export function spawnChildProcess({ command, parameter, messageHandlers }) {
  const handlerEntries = Object.entries(messageHandlers)
  const child = spawn(
    command, parameter, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] }
  )

  child.on('message', message => {
    for (const [key, handler] of handlerEntries) {

      const content = message[key]
      if (!content) return

      handler(content)
        .then(result => child.send({ '_id': message['_id'], [key]: result }))
        .catch(e => console.error(e))
    }
  })
}

/**
 * @template {{ [key: string]: string }} T
 * @param {T} methods
 */
export function setupParentProcessCommunication(methods) {
  let nextId = 0
  const resolvers = new Map()

  process.on('message', handleMessage)

  return mapValues(methods, messageKey =>
    params => request(messageKey, params)
  )

  function request(messageKey, params) {
    return new Promise(resolve => {
      const id = nextId++
      resolvers.set(id, { messageKey, resolve })
      process.send({ __id: id, [messageKey]: params })
    })
  }

  function handleMessage(message) {
    const id = message.__id
    if (!id) return

    const handler = resolvers.get(id)
    if (!handler) return

    resolvers.delete(id)
    const { messageKey, resolve } = handler

    const content = message[messageKey]
    if (!content) return

    resolve(content)
  }
}

/**
 * @template {object} T
 * @template {(value: T[keyof T], key?: keyof T, o?: T) => any} F
 * @param {T} o
 * @param {F} f
 * @returns {{ [key in keyof T]: ReturnType<F> }}
 */
function mapValues(o, f) {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, f(v, k, o)])
  )
}
