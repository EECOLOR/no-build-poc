import path from 'node:path'
import { pathToFileURL } from 'node:url'

const srcRootUrl = pathToFileURL(path.join(path.resolve('./code'), 'file-in-root')).href

export async function resolve(specifier, context, nextResolve) {
  return specifier.startsWith('/')
    ? nextResolve(`.${specifier}`, { ...context, parentURL: srcRootUrl })
    : nextResolve(specifier, context)
}
