import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

import { importedClientFiles } from '#import-client-only/hook-bridge.js'
import { importedUniversalFiles } from '#import-universal/hook-bridge.js'
import { cssFiles } from '#import-css/hook-bridge.js'
import { setupParentProcessCommunication } from '#utils/child-process.js'
import { handleShutdown } from '#utils/shutdown.js'

const parent = setupParentProcessCommunication({
  'getDependencies': 'watch:get-dependencies',
})

handleShutdown(() => {
  console.log('Shutdown detected, initiating cleanup')
  fs.rmSync('./tmp', { recursive: true, force: true })
})

export const app = {
  clientFiles: await resolveAllClientFiles([].concat(importedClientFiles, importedUniversalFiles)),
  cssFiles: await writeAllCssFiles(cssFiles),
}

async function writeAllCssFiles(cssFiles) {
  return cssFiles.map(({ url, modifiedSource, classMapAsJs }) => {
    const relativePath = path.relative(path.resolve('./src'), fileURLToPath(url))

    const modifiedSourcePath = `./tmp/${relativePath}`
    const classMapAsJsPath = `./tmp/${relativePath}.js`

    fs.mkdirSync(path.dirname(`./tmp/${relativePath}`), { recursive: true })
    fs.writeFileSync(modifiedSourcePath, modifiedSource)
    fs.writeFileSync(classMapAsJsPath, classMapAsJs)

    return { url, modifiedSourcePath, classMapAsJsPath }
  })
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
