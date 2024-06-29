import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as esbuild from 'esbuild'

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
    const prefix = path.relative('./src', filePath).replaceAll(/\//g, '_').slice(0, -4)
    const source = fs.readFileSync(filePath, 'utf8')

    const modifiedSource = await prefixClasses(prefix, source)
    const classMap = createClassMap(prefix, modifiedSource)

    const classMapAsJs = `export default ${JSON.stringify(classMap)}`

    processedCssPort.postMessage({ url, modifiedSource, classMapAsJs })

    return { format: 'module', shortCircuit: true, source: classMapAsJs }
  }

  return nextLoad(url, context)
}

async function prefixClasses(prefix, source) {
  const { code } = await esbuild.transform(source, {
    sourcefile: `${prefix}.css`,
    loader: 'local-css',
    // https://en.wikipedia.org/wiki/Timeline_of_web_browsers#2020s
    target: ['chrome94', 'opera79', 'edge94', 'firefox92', 'safari15'],
  })
  return code
}

function createClassMap(prefix, source) {
  const classRegExp = new RegExp(String.raw`${prefix}_([\w]+)`, 'g')
  const classMap = {}
  let match
  while (match = classRegExp.exec(source)) {
    const [replacement, className] = match
    classMap[className] = replacement
  }
  return classMap
}
