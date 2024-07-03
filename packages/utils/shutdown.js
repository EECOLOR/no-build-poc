let shuttingDown = false
const shutdownHandlers = []

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function shutdown() {
  if (shuttingDown) return
  process.off('SIGINT', shutdown)
  process.off('SIGTERM', shutdown)
  shuttingDown = true
  shutdownHandlers.forEach(handler => handler())
}

export function handleShutdown(handler) {
  shutdownHandlers.push(handler)
}
