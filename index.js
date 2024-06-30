import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { startServer } from '#server'
import { importedClientFiles } from '#import-client-only/hook-bridge.js'
import { importedUniversalFiles } from '#import-universal/hook-bridge.js'
import { cleanup, processedCss } from '#import-css/hook-bridge.js'
import { setupParentProcessCommunication } from '#utils/child-process.js'

import { IndexHtml } from '/IndexHtml.js'

const parent = setupParentProcessCommunication({
  'getDependencies': 'custom-resolve:get-dependencies',
})

await startServer({
  IndexComponent: IndexHtml,
  clientFiles: await resolveAllClientFiles([].concat(importedClientFiles, importedUniversalFiles)),
  processedCss,
})

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function shutdown() {
  console.log('Shutdown detected, initiating cleanup')
  cleanup()
  process.exit(0)
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
