import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('node:worker_threads').MessagePort} */
let clientFilesPort = null
let clientSuffix = null
let universalSuffix = null

let pending = {}

/**
 * @param {{
 *  clientFilesPort: import('node:worker_threads').MessagePort,
 *  clientSuffix: string,
 *  universalSuffix: string,
 * }} data
 */
export async function initialize(data) {
  clientFilesPort = data.clientFilesPort
  clientSuffix = data.clientSuffix
  universalSuffix = data.universalSuffix

  startListeningForMessages()
}

export async function resolve(specifier, context, nextResolve) {
  const { parentURL } = context // capture parent, might be modified by the function below
  const result = await nextResolve(specifier, context)

  const { url } = result
  if (!url || !parentURL)
    return result

  if (url.endsWith(universalSuffix) || url.endsWith(clientSuffix)) {
    await sendMessage({ url, specifier })
  }

  if (url.endsWith(clientSuffix)) {
    return { ...result, format: 'client-only' }
  }

  return result
}

export async function load(url, context, nextLoad) {
  if (context.format === 'client-only') {
    const relativePath = `/static/${path.relative(path.resolve('./src'), fileURLToPath(url))}`
    const relativePathExport = `export default ${JSON.stringify(relativePath)}`
    return { format: 'module', shortCircuit: true, source: relativePathExport }
  }

  return nextLoad(url, context)
}

function startListeningForMessages() {
  clientFilesPort.on('message', message => {
    const content = message['client-files:new-client-file']
    if (!content) return

    const key = getKey(content)
    const receiver = pending[key]
    if (!receiver) return
    delete pending[key]
    receiver()
  })
}

function getKey({ url, specifier }) {
  return `${url}_${specifier}`
}

async function sendMessage(content) {
  const key = getKey(content)
  return Promise.race([
    new Promise(resolve => {
      if (pending[key])
        return resolve()

      pending[key] = resolve
      clientFilesPort.postMessage({ ['client-files:new-client-file']: content })
    }),
    new Promise((resolve, reject) => setTimeout(() => reject('timeout'), 2000))
  ])
}
