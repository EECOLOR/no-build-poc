import { MessageChannel } from 'worker_threads'
import { setupMessageRequestCommunication, setupMessageResponseCommunication } from './messages.js'
import { handleShutdown } from './shutdown.js'

export function createMessageChannel() {
  const messageChannel = new MessageChannel()

  handleShutdown(() => {
    messageChannel.port1.close()
    messageChannel.port2.close()
  })

  return messageChannel
}

export function setupChannelResponse({ port, messageKey, handler }) {
  setupMessageResponseCommunication({
    messageKey,
    subscribe(handler) {
      port.on('message', handler)
      return () => { port.off('message', handler) }
    },
    send(message) {
      port.postMessage(message)
    },
    handler
  })
}

export function setupChannelRequest({ port, messageKey }) {
  return setupMessageRequestCommunication({
    messageKey,
    subscribe(handler) {
      port.on('message', handler)
      return () => { port.off('message', handler) }
    },
    send(message) {
      port.send(message)
    },
  }).request
}
