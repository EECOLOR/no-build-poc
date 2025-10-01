/** @import { ResolveHook, ResolveHookContext } from 'node:module' */

/**
 * @typedef {Parameters<ResolveHook>} P
 *
 * @arg {P[0]} specifier
 * @arg {P[1]} context
 * @arg {P[2]} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
  if (!specifier.endsWith('#browser'))
    return nextResolve(specifier, context)

  const [specifierWithoutSuffix] = specifier.split('#')
  return nextResolve(specifierWithoutSuffix, { ...context, conditions: ['browser', 'import'] })
}
