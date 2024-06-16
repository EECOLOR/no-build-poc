import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

/** @type {import('node:worker_threads').MessagePort} */
let processedCssPort = null

/**
 * @param {{
 *   processedCssPort: import('node:worker_threads').MessagePort
 * }} data
 */
export function initialize(data) {
  processedCssPort = data.processedCssPort
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    const filePath = fileURLToPath(url)
    const source = fs.readFileSync(filePath, 'utf8')

    const { classMap, modifiedSource } = suffixClasses(source, computeHash(url))
    const classMapAsJs = `export default ${JSON.stringify(classMap)}`

    processedCssPort.postMessage({ url, modifiedSource, classMapAsJs })

    return { format: 'module', shortCircuit: true, source: classMapAsJs }
  }

  return nextLoad(url, context)
}

// TODO: use css parser
function suffixClasses(source, suffix) {
  const classMap = {}
  const modifiedSource = source.replaceAll(/\.([\w]+)/g, (_, className) => {
    const replacement = `${className}-${suffix}`
    classMap[className] = replacement
    return `.${replacement}`
  })

  return { classMap, modifiedSource }
}

function computeHash(content) {
  const hash = crypto.createHash('md5')
  hash.write(content)
  return hash.digest('hex')
}
