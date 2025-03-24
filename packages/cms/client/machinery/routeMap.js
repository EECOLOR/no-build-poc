/**
 * @template R
 * @template T
 * @param {R} routeOrRouteMap
 * @param {import('#typescript/utils.ts').Const<T>} params
 * @returns {import('./routeMapTypes.ts').ProvideParamsToRouteMap<R, T>}
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
