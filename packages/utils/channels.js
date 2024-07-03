import { MessageChannel } from 'worker_threads'
import { handleShutdown } from './shutdown.js'

export function createMessageChannel() {
  const messageChannel = new MessageChannel()

  handleShutdown(() => {
    messageChannel.port1.close()
    messageChannel.port2.close()
  })

  return messageChannel
}
