import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { importedClientFiles } from '#import-client-only/hook-bridge.js'
import { importedUniversalFiles } from '#import-universal/hook-bridge.js'
import { cssFiles } from '#import-css/dev/hook-bridge.js'
import { setupParentProcessCommunication } from '#utils/child-process.js'

const getDependencies = setupParentProcessCommunication('watch:get-dependencies')

export const app = {
  clientFiles: await resolveAllClientFiles([].concat(importedClientFiles, importedUniversalFiles)),
  cssFiles,
}

async function resolveAllClientFiles(clientFiles) {
  const dependencies = await getDependencies(clientFiles.map(x => fileURLToPath(x.url)))

  let allClientFiles = clientFiles.slice()

  for (const { file, specifier } of dependencies) {
    const url = pathToFileURL(path.resolve(file)).href
    allClientFiles.push({ url, specifier })
  }

  return allClientFiles
}
