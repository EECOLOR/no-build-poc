/** @import { Const } from '#typescript/utils.ts' */
/** @import { ProvideParamsToRouteMap } from './routeMapTypes.ts' */

/**
 * @template R
 * @template T
 * @arg {string} basePath
 * @arg {R} routeOrRouteMap
 * @arg {Const<T>} params
 * @returns {ProvideParamsToRouteMap<R, T>}
 */
export function withParamsAndPrefix(basePath, routeOrRouteMap, params) {
  return new Proxy(/** @type {any} */ (routeOrRouteMap), {
    get(target, p) {
      return withParamsAndPrefix(basePath, target[p], params)
    },
    apply(target, _, [providedParams]) {
      return basePath + target({ ...params, ...providedParams })
    },
  })
}
