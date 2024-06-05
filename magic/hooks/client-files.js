/** @type {import('node:worker_threads').MessagePort} */
let clientFilesPort = null
let clientFileSuffixes = null

const clientFiles = new Set()

/**
 * @param {{
 *  clientFilesPort: import('node:worker_threads').MessagePort,
 *  clientFileSuffixes: Array<string>,
 * }} data
 */
export async function initialize(data) {
  clientFilesPort = data.clientFilesPort
  clientFileSuffixes = data.clientFileSuffixes
}

export async function resolve(specifier, context, nextResolve) {
  const { parentURL } = context // capture parent, might be modified by the function below
  const result = await nextResolve(specifier, context)

  const { url } = result
  if (!url || !parentURL || clientFiles.has(url))
    return result

  if (clientFiles.has(parentURL) || clientFileSuffixes.some(suffix => url.endsWith(suffix))) {
    clientFiles.add(url)
    const { url: browserUrl } = await nextResolve(specifier, { ...context, conditions: ['browser', 'import'] })
    clientFilesPort.postMessage({ url: browserUrl, specifier })
  }

  return result
}
