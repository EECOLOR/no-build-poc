import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('node:worker_threads').MessagePort} */
let clientFilesPort = null
let clientSuffix = null
let universalSuffix = null

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
}

export async function resolve(specifier, context, nextResolve) {
  const { parentURL } = context // capture parent, might be modified by the function below
  const result = await nextResolve(specifier, context)

  const { url } = result
  if (!url || !parentURL)
    return result

  if (url.endsWith(universalSuffix) || url.endsWith(clientSuffix)) {
    clientFilesPort.postMessage({ url, specifier })

    // TODO: wait for postMessage({ url, specifier }) to be processed
    console.log('checking', url)
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('done checking', url)
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
