import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { importedClientFiles } from '#import-client-only/hook-bridge.js'
import { importedUniversalFiles } from '#import-universal/hook-bridge.js'
import { cleanupGeneratedCssFiles, cssFiles } from '#import-css/hook-bridge.js'
import { setupParentProcessCommunication } from '#utils/child-process.js'
import { handleShutdown } from '#utils/shutdown.js'

const parent = setupParentProcessCommunication({
  'getDependencies': 'watch:get-dependencies',
})

handleShutdown(() => {
  console.log('Shutdown detected, initiating cleanup')
  cleanupGeneratedCssFiles()
})

export const app = {
  clientFiles: await resolveAllClientFiles([].concat(importedClientFiles, importedUniversalFiles)),
  cssFiles,
}

async function resolveAllClientFiles(clientFiles) {
  const dependencies = await parent.getDependencies(clientFiles.map(x => fileURLToPath(x.url)))

  let allClientFiles = clientFiles.slice()

  for (const { file, specifier } of dependencies) {
    const url = pathToFileURL(path.resolve(file)).href
    allClientFiles.push({ url, specifier })
  }

  return allClientFiles
}
