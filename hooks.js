import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

export async function resolve(specifier, context, nextResolve) {

  if (specifier.startsWith('/'))
    return resolveRootSlashImport(specifier, context, nextResolve)

  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css'))
    return loadCss(url)

  return nextLoad(url, context)
}

function resolveRootSlashImport(specifier, context, nextResolve) {
  return nextResolve(`.${specifier}`, { ...context, parentURL: import.meta.url })
}

function loadCss(url) {
  const filePath = fileURLToPath(url)
  const relativePath = path.relative(process.cwd(), filePath)
  const source = fs.readFileSync(filePath, 'utf8')

  const prefix = `${hash(url)}-`

  const { replacements, modifiedSource } = prefixClasses(source, prefix)
  const parsedCss = `export default ${JSON.stringify(replacements)}`

  fs.mkdirSync('./tmp', { recursive: true })
  fs.writeFileSync(`./tmp/${relativePath}.source`, modifiedSource)
  fs.writeFileSync(`./tmp/${relativePath}.exports`, parsedCss)

  return { format: 'module', shortCircuit: true, source: parsedCss }
}

function prefixClasses(source, prefix) {
  const replacements = {}
  const modifiedSource = source.replaceAll(/\.([\w]+)/g, (_, className) => {
    const replacement = `${prefix}${className}`
    replacements[className] = replacement
    return `.${replacement}`
  })

  return { replacements, modifiedSource }
}

function hash(content) {
  const hash = crypto.createHash('md5')
  hash.write(content)
  return hash.digest('hex')
}
