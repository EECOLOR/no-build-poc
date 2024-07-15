import { handleShutdown } from './shutdown.js'

export function setupMessageResponseCommunication({ messageKey, subscribe, send, handler }) {
  const unsubscribe = subscribe(handleMessage)
  handleShutdown(unsubscribe)

  function handleMessage(message) {
    const content = message[messageKey]
    if (!content) return

    Promise.resolve(handler(content))
      .then(result => send({ __id: message.__id, [messageKey]: result }))
      .catch(e => console.error(e))
  }
}

export function setupMessageRequestCommunication({ messageKey, subscribe, send }) {
  let nextId = 1
  const resolvers = new Map()

  const unsubscribe = subscribe(handleMessage)
  handleShutdown(unsubscribe)

  return {
    request(params) {
      return new Promise(resolve => {
        const id = nextId++
        resolvers.set(id, resolve)
        send({ __id: id, [messageKey]: params })
      })
    }
  }

  function handleMessage(message) {
    const id = message.__id
    if (!id) return

    const content = message[messageKey]
    if (!content) return

    const resolver = resolvers.get(id)
    if (!resolver) return

    resolvers.delete(id)
    resolver(content)
  }
}
