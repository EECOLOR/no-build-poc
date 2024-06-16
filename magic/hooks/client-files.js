import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('node:worker_threads').MessagePort} */
let clientFilesPort = null
let clientSuffix = null
let universalSuffix = null

const clientFiles = new Set()
const clientOnlyFiles = new Set()

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
  if (!url || !parentURL || clientFiles.has(url))
    return result

  if (clientFiles.has(parentURL) || url.endsWith(universalSuffix) || url.endsWith(clientSuffix)) {
    clientFiles.add(url)
    const { url: browserUrl } = await nextResolve(specifier, { ...context, conditions: ['browser', 'import'] })
    clientFilesPort.postMessage({ url: browserUrl, specifier })

    if (url.endsWith(clientSuffix) || clientOnlyFiles.has(parentURL)) {
      clientOnlyFiles.add(url)
      // TODO: this should probably be done using a parser like ESBuild, now we are importing client
      // specic code (which will probably have errors or side effects) that are now executed by node.
      await import(url).catch(e => {}) // import to resolve dependencies, since it is client only we can expect runtime errors
      return { ...result, format: 'client-only' }
    }
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
