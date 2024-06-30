import { MessageChannel } from 'node:worker_threads'

const universalFilesChannel = new MessageChannel()

/** @type {Array<{ url: string, specifier: string }>} */
export const importedUniversalFiles = []

export const universalFilesPort = universalFilesChannel.port2

universalFilesChannel.port1.on('message', message => {
  const content = message['universal:new-universal-file']
  if (!content) return

  importedUniversalFiles.push(content)
})
