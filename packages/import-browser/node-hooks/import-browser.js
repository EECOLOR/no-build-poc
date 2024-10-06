import path from 'node:path'
import { pathToFileURL } from 'node:url'

const srcRootUrl = pathToFileURL(path.join(path.resolve('./code'), 'file-in-root')).href

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.endsWith('#browser'))
    return nextResolve(specifier, context)

  const [specifierWithoutSuffix] = specifier.split('#')
  return nextResolve(specifierWithoutSuffix, { ...context, conditions: ['browser', 'import'] })
}
