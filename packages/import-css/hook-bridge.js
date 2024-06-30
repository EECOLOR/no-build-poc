import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MessageChannel } from 'node:worker_threads'

const processedCssChannel = new MessageChannel()

/** @type {Array<{ url: string, modifiedSourcePath: string, classMapAsJsPath: string }>} */
export const processedCss = []

export const processedCssPort = processedCssChannel.port2

export function cleanup() {
  console.log('Removing ./tmp dir')
  fs.rmSync('./tmp', { recursive: true, force: true })
}

processedCssChannel.port1.on('message', ({ url, modifiedSource, classMapAsJs }) => {
  const relativePath = path.relative(path.resolve('./src'), fileURLToPath(url))

  const modifiedSourcePath = `./tmp/${relativePath}`
  const classMapAsJsPath = `./tmp/${relativePath}.js`

  fs.mkdirSync(path.dirname(`./tmp/${relativePath}`), { recursive: true })
  fs.writeFileSync(modifiedSourcePath, modifiedSource)
  fs.writeFileSync(classMapAsJsPath, classMapAsJs)

  processedCss.push({ url, modifiedSourcePath, classMapAsJsPath })
})
