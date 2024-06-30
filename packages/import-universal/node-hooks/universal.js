import path from 'node:path'
import { fileURLToPath } from 'node:url'

const universalSuffix = '.universal.js'

/** @type {import('node:worker_threads').MessagePort} */
let universalFilesPort = null

export async function initialize(data) {
  universalFilesPort = data.universalFilesPort
}

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context)
  const { url } = result

  if (url.endsWith(universalSuffix)) {
    universalFilesPort.postMessage({ ['universal:new-universal-file']: { url, specifier } })
  }

  return result
}

export async function load(url, context, nextLoad) {

  if (url.endsWith(universalSuffix)) {
    const componentPath = `/${path.relative(path.resolve('./src'), fileURLToPath(url))}`
    const serverSource = [
      `import Component from '${componentPath}#prevent-loader-recursion'`,
      `import Universal from '#import-universal/internal/Universal.js'`,
      ``,
      `export default (...params) => Universal('${componentPath}', Component, params)`,
      ``,
    ].join('\n')

    return { format: 'module', shortCircuit: true, source: serverSource }
  }

  return nextLoad(url, context)
}
