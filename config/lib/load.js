import path from 'node:path'
import fs from 'node:fs'

export async function load(configEnv) {
  const configFiles = [
    { name: 'default', required: false, allowOverride: false },
    { name: configEnv, required: true , allowOverride: false },
    { name: 'local'  , required: false, allowOverride: true }
  ]

  return configFiles.reduce(
    async (resultPromise, { name, required, allowOverride }) => {
      const result = await resultPromise
      const configFile = path.resolve('./config', `${name}.js`)

      if (fs.existsSync(configFile)) {
        const config = (await import('/' + path.relative('./src', configFile))).default

        return mergeDeep(result, config, allowOverride)
      } else if (required) {
        throw new Error(`Could not find configuration for '${name}'`)
      } else {
        return result
      }

    },
    Promise.resolve({})
  )
}

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

function isObject(x) {
  const constructor = getConstructor(x)
  return constructor && constructor instanceof constructor
}
function getConstructor(x) { return isObjectLike(x) && Object.getPrototypeOf(x).constructor }
function isObjectLike(x) { return typeof x === 'object' && x !== null }
