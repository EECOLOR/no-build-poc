import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { computeFileHash, computeHash } from './machinery/computeHash.js'

// TODO - split this
// - absolute import
// - fingerprinting
// - css handling
// - universal handling

const srcRootDir = path.resolve('./src')
const srcRootUrl = pathToFileURL(path.join(srcRootDir, 'file-in-root'))

/** @type {import('node:worker_threads').MessagePort} */
let fingerprintPort = null

/** @typedef {string} parentURL */
/** @type {{ [url:string]: Set<parentURL> }} */
const parentLookup = {}

export async function initialize(data) {
  fingerprintPort = data.fingerprintPort
}

export async function resolve(specifier, context, nextResolve) {
  const { parentURL } = context // capture parent, might be modified by the functions below
  const result = specifier.startsWith('/')
    ? await resolveRootSlashImport(specifier, context, nextResolve)
    : await nextResolve(specifier, context)

  const [bareUrl] = result.url.split('?')
  const target = parentLookup[bareUrl] || (parentLookup[bareUrl] = new Set())
  target.add(parentURL)

  if (needsFingerprintedFile(bareUrl)) {
    await fingerprint(bareUrl)
  }

  return result
}

export async function load(url, context, nextLoad) {

  if (url.endsWith('.css'))
    return loadCss(url)

  if (url.endsWith('?fingerprint')) {
    const { fingerprintPath } = await fingerprint(url)
    const serverSource = `export default ${JSON.stringify(fingerprintPath)}`
    return { format: 'module', shortCircuit: true, source: serverSource}
  }

  if (url.endsWith('.universal.js')) {
    const { relativePath } = await fingerprint(url)

    const componentPath = `/` + relativePath
    const serverSource = [
      `import Component from '${componentPath}#not-universal'`,
      `import { Universal } from '/machinery/Universal.js'`,
      ``,
      `export default props => Universal('${componentPath}', Component, props)`,
      ``,
    ].join('\n')

    return { format: 'module', shortCircuit: true, source: serverSource }
  }

  return nextLoad(url, context)
}

function resolveRootSlashImport(specifier, context, nextResolve) {
  return nextResolve(`.${specifier}`, { ...context, parentURL: srcRootUrl })
}

function needsFingerprintedFile(url) {
  return (
    Boolean(url) &&
    // .css is handled manually
    !url.endsWith('.css') &&
    (
      url.endsWith('.universal.js') ||
      url.endsWith('?fingerprint') ||
      parentNeedsFingerprintedFile(url)
    )
  )
}

function parentNeedsFingerprintedFile(url) {
  const parents = parentLookup[url]
  return Boolean(parents) && Array.from(parents).some(needsFingerprintedFile)
}

async function loadCss(url) {
  const filePath = fileURLToPath(url)
  const source = fs.readFileSync(filePath, 'utf8')
  const { hash, relativePath, fingerprintPath } = await getFingerprint(filePath)

  const suffix = `-${computeHash(url)}`

  const { replacements, modifiedSource } = suffixClasses(source, suffix)
  const parsedCss = `export default ${JSON.stringify(replacements)}`

  const namespacedSourcePath = `./tmp/${relativePath}.css`
  const exportsPath = `./tmp/${relativePath}.css.js`

  fs.mkdirSync(path.dirname(`./tmp/${relativePath}`), { recursive: true })
  fs.writeFileSync(namespacedSourcePath, modifiedSource)
  fs.writeFileSync(exportsPath, parsedCss)

  fingerprintPort.postMessage({
    hash, filePath: namespacedSourcePath, relativePath, fingerprintPath, excludeFromImportMap: true
  })
  fingerprintPort.postMessage({
    hash, filePath: exportsPath, relativePath, fingerprintPath: `${fingerprintPath}.js`
  })

  return { format: 'module', shortCircuit: true, source: parsedCss }
}

async function fingerprint(url) {
  const filePath = fileURLToPath(url)
  const { hash, relativePath, fingerprintPath } = await getFingerprint(filePath)

  fingerprintPort.postMessage({ hash, filePath, relativePath, fingerprintPath })

  return { relativePath, fingerprintPath }
}

async function getFingerprint(filePath) {
  const relativePath = getRelativePath(filePath)
  const hash = await computeFileHash(filePath) // TODO use file stream for the hash
  const fingerprintPath = `/static/${relativePath.replace(/\.(\w+)$/, `.${hash}.$1`)}`

  return { hash, relativePath, fingerprintPath }
}

function getRelativePath(filePath) {
  const relativePath = path.relative(srcRootDir, filePath)
  // console.log({ srcRootDir, filePath, relativePath })
  return relativePath
}

function suffixClasses(source, suffix) {
  const replacements = {}
  const modifiedSource = source.replaceAll(/\.([\w]+)/g, (_, className) => {
    const replacement = `${className}${suffix}`
    replacements[className] = replacement
    return `.${replacement}`
  })

  return { replacements, modifiedSource }
}
