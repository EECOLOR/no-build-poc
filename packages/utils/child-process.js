import { spawn } from 'node:child_process'
import { mapValues } from '#utils'

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
        .then(result => child.send({ '__id': message['__id'], [key]: result }))
        .catch(e => console.error(e))
    }
  })
}

/**
 * @template {{ [key: string]: string }} T
 * @param {T} methods
 */
export function setupParentProcessCommunication(methods) {
  let nextId = 1
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
