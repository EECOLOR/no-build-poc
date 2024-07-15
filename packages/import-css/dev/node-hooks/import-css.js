import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as esbuild from 'esbuild'
import fs from 'node:fs'

/** @type {import('node:worker_threads').MessagePort} */
let cssFilesPort = null
let cssTmpDir = null

/**
 * @param {{
 *   cssFilesPort: import('node:worker_threads').MessagePort
 *   cssTmpDir: string
 * }} data
 */
export function initialize(data) {
  cssFilesPort = data.cssFilesPort
  cssTmpDir = data.cssTmpDir
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    const filePath = fileURLToPath(url)
    const prefix = path.relative('./src', filePath).replaceAll(/\//g, '_').slice(0, -4)
    const source = fs.readFileSync(filePath, 'utf8')

    const modifiedSource = await prefixClasses(prefix, source)
    const classMap = createClassMap(prefix, modifiedSource)

    const classMapAsJs = `export default ${JSON.stringify(classMap)}`

    const { modifiedSourcePath, classMapAsJsPath } =
      await writeCssFiles({ url, modifiedSource, classMapAsJs })

    cssFilesPort.postMessage({ 'import-css:new-css-file': { url, modifiedSourcePath, classMapAsJsPath } })

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

async function writeCssFiles({ url, modifiedSource, classMapAsJs }) {
  const relativePath = path.relative(path.resolve('./src'), fileURLToPath(url))

  const modifiedSourcePath = `${cssTmpDir}${relativePath}`
  const classMapAsJsPath = `${modifiedSourcePath}.js`

  fs.mkdirSync(path.dirname(modifiedSourcePath), { recursive: true })
  fs.writeFileSync(modifiedSourcePath, modifiedSource)
  fs.writeFileSync(classMapAsJsPath, classMapAsJs)

  return { modifiedSourcePath, classMapAsJsPath }
}
