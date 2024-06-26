import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MessageChannel } from 'node:worker_threads'

const clientFilesChannel = new MessageChannel()
const processedCssChannel = new MessageChannel()

/** @type {Array<{ url: string, specifier: string }>} */
export const clientFiles = []

/** @type {Array<{ url: string, modifiedSourcePath: string, classMapAsJsPath: string }>} */
export const processedCss = []

export const clientFilesPort = clientFilesChannel.port2
export const processedCssPort = processedCssChannel.port2

export function cleanup() {
  console.log('Removing ./tmp dir')
  fs.rmSync('./tmp', { recursive: true, force: true })
}

process.on('message', message => {
  const content = message['custom-result:get-dependencies']
  if (!content) return

  const dependencies = content
  dependencies.forEach(({ file, specifier }) => {
    const url = pathToFileURL(path.resolve(file)).href
    clientFiles.push({ url, specifier })
  })
})

clientFilesChannel.port1.on('message', message => {
  clientFiles.push(message)
  process.send({ 'custom-resolve:get-dependencies': message })
})

processedCssChannel.port1.on('message', ({ url, modifiedSource, classMapAsJs }) => {
  const relativePath = path.relative(path.resolve('./src'), fileURLToPath(url))

  const modifiedSourcePath = `./tmp/${relativePath}`
  const classMapAsJsPath = `./tmp/${relativePath}.js`

  fs.mkdirSync(path.dirname(`./tmp/${relativePath}`), { recursive: true })
  fs.writeFileSync(modifiedSourcePath, modifiedSource)
  fs.writeFileSync(classMapAsJsPath, classMapAsJs)

  processedCss.push({ url, modifiedSourcePath, classMapAsJsPath })
})
