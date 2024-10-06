let shuttingDown = false
const shutdownHandlers = []

export function handleShutdown(handler) {
  shutdownHandlers.push(handler)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function shutdown() {
  if (shuttingDown) return
  process.off('SIGINT', shutdown)
  process.off('SIGTERM', shutdown)
  shuttingDown = true
  for (const handler of shutdownHandlers) handler()
}
