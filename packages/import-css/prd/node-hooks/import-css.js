import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** @type {import('node:worker_threads').MessagePort} */
let cssFilesPort = null

/**
 * @param {{
 *   cssFilesPort: import('node:worker_threads').MessagePort
 * }} data
 */
export function initialize(data) {
  cssFilesPort = data.cssFilesPort
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {

    cssFilesPort.postMessage({ 'import-css:new-css-file': { url, modifiedSource, classMapAsJs } })

    return { format: 'module', shortCircuit: true, source: classMapAsJs }
  }

  return nextLoad(url, context)
}
