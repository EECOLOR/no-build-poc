import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { importedClientFiles, clearClientFiles } from '#import-client-only/hook-bridge.js'
import { importedUniversalFiles, clearUniversalFiles } from '#import-universal/hook-bridge.js'
import { cssFiles, clearCssFiles } from '#import-css/dev/hook-bridge.js'
import { setupParentProcessCommunication } from '#utils/child-process.js'

const getDependencies = setupParentProcessCommunication('watch:get-dependencies')

export async function importFile(file) {
  resetFiles()
  const imported = await import(file)
  const { cssFiles, clientFiles } = await getFiles()

  return { imported, cssFiles, clientFiles }
}

async function getFiles() {
  return  {
    clientFiles: await resolveAllClientFiles([].concat(importedClientFiles, importedUniversalFiles)),
    cssFiles: cssFiles.slice(),
  }
}

function resetFiles() {
  clearClientFiles()
  clearUniversalFiles()
  clearCssFiles()
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
