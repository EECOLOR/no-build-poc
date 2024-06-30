const clientSuffix = '.client.js'

/** @type {import('node:worker_threads').MessagePort} */
let clientFilesPort = null

export async function initialize(data) {
  clientFilesPort = data.clientFilesPort
}

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context)
  const { url } = result

  if (url.endsWith(clientSuffix)) {
    clientFilesPort.postMessage({ ['import-client-only:new-client-only-file']: { url, specifier } })

    return { ...result, format: 'client-only' }
  }

  return result
}

export async function load(url, context, nextLoad) {
  if (context.format === 'client-only') {
    const relativePathExport =
      `import { getPublicPath } from '#server'\n` +
      `export default getPublicPath('${url}')\n`
    return { format: 'module', shortCircuit: true, source: relativePathExport }
  }

  return nextLoad(url, context)
}
