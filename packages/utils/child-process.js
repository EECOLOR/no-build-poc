import { spawn } from 'node:child_process'
import { setupMessageRequestCommunication, setupMessageResponseCommunication } from './messages.js'

export function spawnChildProcess({ command, parameter, messageHandlers }) {
  const child = spawn(
    command, parameter, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] }
  )
  for (const [messageKey, handler] of Object.entries(messageHandlers)) {
    setupMessageResponseCommunication({
      messageKey,
      subscribe(handler) {
        child.on('message', handler)
        return () => { child.off('message', handler) }
      },
      send(message) {
        child.send(message)
      },
      handler
    })
  }
}

export function setupParentProcessCommunication(messageKey) {
  return setupMessageRequestCommunication({
    messageKey,
    subscribe(handler) {
      process.on('message', handler)
      return () => { process.off('message', handler) }
    },
    send(message) {
      process.send(message)
    },
  }).request
}
