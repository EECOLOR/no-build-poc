import { createMessageChannel } from '#utils/channels.js'

const clientFilesChannel = createMessageChannel()

/** @type {Array<{ url: string, specifier: string }>} */
export const importedClientFiles = []

export const clientFilesPort = clientFilesChannel.port2

export function clearClientFiles() {
  importedClientFiles.length = 0
}

clientFilesChannel.port1.on('message', message => {
  const content = message['import-client-only:new-client-only-file']
  if (!content) return

  importedClientFiles.push(content)
})
