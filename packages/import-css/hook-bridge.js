import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MessageChannel } from 'node:worker_threads'

const cssFilesChannel = new MessageChannel()

/** @type {Array<{ url: string, modifiedSourcePath: string, classMapAsJsPath: string }>} */
export const cssFiles = []

export const cssFilesPort = cssFilesChannel.port2

export function cleanupGeneratedCssFiles() {
  console.log('Removing ./tmp dir')
  fs.rmSync('./tmp', { recursive: true, force: true })
}

cssFilesChannel.port1.on('message', message => {
  const content = message['import-css:new-css-file']
  if (!content) return

  const { url, modifiedSource, classMapAsJs } = content
  const relativePath = path.relative(path.resolve('./src'), fileURLToPath(url))

  const modifiedSourcePath = `./tmp/${relativePath}`
  const classMapAsJsPath = `./tmp/${relativePath}.js`

  fs.mkdirSync(path.dirname(`./tmp/${relativePath}`), { recursive: true })
  fs.writeFileSync(modifiedSourcePath, modifiedSource)
  fs.writeFileSync(classMapAsJsPath, classMapAsJs)

  cssFiles.push({ url, modifiedSourcePath, classMapAsJsPath })
})
