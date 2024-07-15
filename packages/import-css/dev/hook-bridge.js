import { createMessageChannel } from '#utils/channels.js'

const cssFilesChannel = createMessageChannel()

/** @type {Array<{ url: string, modifiedSourcePath: string, classMapAsJsPath: string }>} */
export const cssFiles = []

export const cssFilesPort = cssFilesChannel.port2

cssFilesChannel.port1.on('message', message => {
  const content = message['import-css:new-css-file']
  if (!content) return

  cssFiles.push(content)
})
