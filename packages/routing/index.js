/** @import { Const } from '#typescript/utils.js' */
/** @import { AsRouteMap, Config, ExtractLocaleParamName, Route, RouteInputChildren } from './types.ts' */

export const defaultConfig = {
  trailingSlash: true,
  localeParamName: 'language',
}

export const routeMapSymbol = Symbol('routeMapSymbol')
export const routeSymbol = Symbol('routeSymbol')

/**
 * @template {Config} P
 * @template {RouteInputChildren} T
 *
 * @param {Const<T>} map
 * @param {Const<P>} [userConfig]
 *
 * @returns {AsRouteMap<T, ExtractLocaleParamName<P>>}
 */
export function asRouteMap(map, userConfig) {
  const config = Object.assign({}, defaultConfig, userConfig)
  const childRoutes = createRouteChildren(config, map)
  return /** @type {any} */ ({
    ...childRoutes,
    [routeMapSymbol]: { children: asSortedArray(childRoutes), config }
  })
}

export function asRouteChain(route) {
  const result = []
  let currentRoute = route
  while (currentRoute) {
    result.unshift(currentRoute)
    currentRoute = currentRoute[routeSymbol].parent
  }
  return result
}

export function match(routeMap, path) {
  if (!routeMap.hasOwnProperty(routeMapSymbol))
    throw new Error('Please create the routeMap using the `asRouteMap` function')

  const pathSegments = path.split('/').filter(Boolean)
  const result = matchChildren(pathSegments, routeMap[routeMapSymbol].children)
  return result ? result : null
}

function matchChildren(pathSegments, children, previousParams = {}) {
  for (const route of children) {
    const { match, children } = route[routeSymbol]

    const info = match(pathSegments, previousParams)
    if (!info)
      continue

    const { params, remainingSegments } = info

    const hasChildren = Boolean(children.length)
    const hasRemainingSegments = Boolean(remainingSegments.length)

    const potentialMatch = hasChildren || !hasRemainingSegments
    if (!potentialMatch)
      continue

    const combinedParams = { ...previousParams, ...params }
    const resultFromChildren = matchChildren(remainingSegments, children, combinedParams)
    if (resultFromChildren)
      return resultFromChildren

    if (!hasRemainingSegments)
      return { params: combinedParams, route }
  }
}

function createRouteChildren(config, children, getParent = () => null, parentName = '') {
  return mapValues(children, (childOrPath, key) => {
    const routeInput = typeof childOrPath === 'string' ? { path: childOrPath } : childOrPath
    return createRoute(config, routeInput, getParent, parentName ? `${parentName}.${key}` : key)
  })
}

function createRoute(config, routeInput, getParent, name) {
  const { path, data = undefined, ...children } = routeInput
  if (path === undefined)
    throw new Error(`No path found in '${name}': ${JSON.stringify(routeInput)}`)

  const childRoutes = createRouteChildren(config, children, () => route, name)

  const info = determinePathInfo(path, config)

  let parent = null
  const route = withReverseRoute(config, {
    ...childRoutes,
    toString() { return name },
    path,
    data,
    [routeSymbol]: {
      get parent() {
        if (!parent) parent = getParent()
        return parent
      },
      children: asSortedArray(childRoutes),
      name,
      path: info.path,
      match: info.match,
      score: info.score,
    },
  })

  return route
}

function determinePathInfo(routePath, config) {
  return typeof routePath === 'string'
    ? createPathInfo(routePath)
    : createLocalizedPathInfo(routePath, config)
}

function createPathInfo(routePath) {
  const routeSegments = routePath.split('/').filter(Boolean)
  const segmentFunctions = routeSegments.map(createSegmentFunctions)

  return {
    path(params) {
      let path = ''
      for (const segmentFunction of segmentFunctions) {
        path = `${path}/${segmentFunction.path(params)}`
      }
      return path
    },

    match(pathSegments) {
      const params = {}
      let remainingSegments = pathSegments

      for (const segmentFunction of segmentFunctions) {
        const match = segmentFunction.match(remainingSegments)
        if (!match)
          return

        Object.assign(params, match.params)
        remainingSegments = match.remainingSegments
      }

      return { params, remainingSegments }
    },

    score: calculateScore(routePath),
  }
}

function createSegmentFunctions(routeSegment) {
  return (
    routeSegment.startsWith(':') ? createParamFunctions(routeSegment.slice(1)) :
    routeSegment === '*' ? createWildcardFunctions() :
    createStaticFunctions(routeSegment)
  )
}

function createParamFunctions(paramName) {
  return {
    path: params => params[paramName],
    match: ([segment, ...remainingSegments]) => segment && {
      params: { [paramName]: segment },
      remainingSegments,
    },
  }
}

function createWildcardFunctions() {
  return {
    path: params => params['*'],
    match: remainingSegments => remainingSegments.length && {
      params: { '*': remainingSegments.join('/') },
      remainingSegments: []
    },
  }
}

function createStaticFunctions(routeSegment) {
  return {
    path: params => routeSegment,
    match: ([segment, ...remainingSegments]) => segment === routeSegment && {
      params: null,
      remainingSegments,
    }
  }
}

function createLocalizedPathInfo(routePaths, config) {
  const pathFunctions = mapValues(routePaths, createPathInfo)

  return {
    path(params) {
      const locale = params[config.localeParamName]
      if (!locale)
        throw new Error(`Could not determine locale, '${config.localeParamName}' is missing in params:\n${params}`)

      const pathFunction = pathFunctions[locale]
      if (!pathFunction)
        throw new Error(`Could not determine what path to use for locale '${locale}' in localized paths object:\n${routePaths}`)

      return pathFunction.path(params)
    },

    match(pathSegments, params) {
      const locale = params[config.localeParamName]
      if (!locale)
        return

      const pathFunction = pathFunctions[locale]
      if (!pathFunction)
        return

      return pathFunction.match(pathSegments)
    },

    score: determineScore(routePaths)
  }
}

function determineScore(routePaths) {
  const scores = new Set(Object.values(routePaths).map(calculateScore))
  if (scores.size > 1)
    throw new Error(
      `Paths in localized path object have different scores:\n` +
      JSON.stringify(routePaths, null, 2)
    )

  const [score] = Array.from(scores)
  return score
}

function calculateScore(path) {
  let totalScore = 0

  for (const [i, segment] of path.split('/').entries()) {
    const score =
      segment === '*' ? -2 :
      segment.startsWith(':') ? 4 :
      8

    totalScore += score / (i + 1)
  }

  return totalScore
}

/** @returns {Route} */
function withReverseRoute(config, route) {
  const pathEnd = config.trailingSlash ? '/' : ''
  return Object.assign(reverseRoute, route)

  function reverseRoute(params = {}) { // TODO: should we add support for query string params?
    let resolvedPath = ''
    let currentRoute = route

    do {
      const { path, parent } = currentRoute[routeSymbol]
      resolvedPath = path(params) + resolvedPath
      currentRoute = parent
    } while (currentRoute)

    return resolvedPath ? resolvedPath + pathEnd : '/'
  }
}

function asSortedArray(children) {
  return Object.values(children).sort((a, b) => b[routeSymbol].score - a[routeSymbol].score)
}

/**
 * @template {{ [key: string | number | symbol]: any }} O
 * @template {(v: O[keyof O], k: keyof O, o: O) => any} F
 *
 * @param {O} o
 * @param {F} f
 * @returns {{ [key in keyof O]: ReturnType<F> }}
 */
function mapValues(o, f) {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, f(v, k, o)])
  )
}
