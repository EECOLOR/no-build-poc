import path from 'node:path'
import fs from 'node:fs'
import url from 'node:url'

const pwd = process.cwd()
const currentPath = path.dirname(url.fileURLToPath(import.meta.url))

/** @arg {string} configEnv */
export async function load(configEnv) {
  const configFiles = [
    { name: 'default', required: false, allowOverride: false },
    { name: configEnv, required: true , allowOverride: false },
    { name: 'local'  , required: false, allowOverride: true }
  ]

  /** @type {{ [key: string]: unknown }} */
  let config = {}

  for (const { name, required, allowOverride } of configFiles) {
    const configFile = path.resolve(pwd, './config', `${name}.js`)

    if (fs.existsSync(configFile)) {
      const configFromFile = (await import(path.relative(currentPath, configFile))).default
      mergeDeep(config, configFromFile, allowOverride)
    } else if (required) {
      throw new Error(`Could not find configuration for '${name}'`)
    }
  }

  return config
}

/**
 * @arg {{ [key: string]: unknown }} target
 * @arg {{ [key: string]: unknown }} source
 * @arg {boolean} allowOverride
 * @arg {Array<string>} path
 */
function mergeDeep(target, source, allowOverride, path = []) {
  return Object.keys(source)
    .reduce((result, key) => {
      const targetValue = result[key]
      const sourceValue = source[key]

      if (isObject(targetValue) && isObject(sourceValue)) {
        result[key] = mergeDeep(targetValue, sourceValue, allowOverride, path.concat(key))
      } else if (targetValue && !allowOverride) {
        throw new Error(`Can not merge values at ${path.join('.')}, only objects can be merged`)
      } else {
        result[key] = sourceValue
      }
      return result
    },
    target
  )
}

/** @arg {unknown} x @return {x is { [key: string]: unknown }} */
function isObject(x) {
  const constructor = getConstructor(x)
  return constructor && constructor instanceof constructor
}
/** @arg {unknown} x */
function getConstructor(x) { return isObjectLike(x) && Object.getPrototypeOf(x).constructor }
/** @arg {unknown} x */
function isObjectLike(x) { return typeof x === 'object' && x !== null }
