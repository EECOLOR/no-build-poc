import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** @import { ResolveHook, ResolveHookContext } from 'node:module' */

const srcRootUrl = pathToFileURL(path.join(path.resolve('./code'), 'file-in-root')).href

/**
 * @typedef {Parameters<ResolveHook>} P
 *
 * @arg {P[0]} specifier
 * @arg {P[1]} context
 * @arg {P[2]} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
  return specifier.startsWith('/')
    ? nextResolve(`.${specifier}`, { ...context, parentURL: srcRootUrl })
    : nextResolve(specifier, context)
}
