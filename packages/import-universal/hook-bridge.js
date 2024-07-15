import { createMessageChannel } from '#utils/channels.js'

const universalFilesChannel = createMessageChannel()

/** @type {Array<{ url: string, specifier: string }>} */
export const importedUniversalFiles = []

export const universalFilesPort = universalFilesChannel.port2

export function clearUniversalFiles() {
  importedUniversalFiles.length = 0
}

universalFilesChannel.port1.on('message', message => {
  const content = message['universal:new-universal-file']
  if (!content) return

  importedUniversalFiles.push(content)
})
