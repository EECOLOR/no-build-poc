/*
  Principles
  - Artibrary keys:
    - The structure should reflect path structure.
    - The names of the keys do not need to be the related to the actual paths, they are for the
      developers.
    - Paths change over time and should not result in changing the code.
    - Multiple paths can be attached to a single item (localization).
  - Central location of path related information (title, data, ...)
  - Allow segmentation (sub-objects available to sub-components)
  - Should be compatible with component thinking
*/
import { callOrReturn, mapValues, throwError } from '#utils'

export const routeSymbol = Symbol('routeSymbol')
export const routeMapSymbol = Symbol('routeMapSymbol')

const emptyObject = {}

/** @type {import('./routeMap').asRouteMap} */
export function asRouteMap(map, config = {}) {
  const children = normalizeChildren(config, map)
  return {
    ...children,
    [routeMapSymbol]: { children: Object.values(children) }
  }
}

export function pick(pathname, [routeMap, defaultHandler], ...overrides) {
  const result = pickRoute(pathname, routeMap)
  if (!result) return null

  const { route, params } = result
  const [override, handler] = overrides.find(([x]) => x === route) || []
  return callOrReturn(override ? handler : defaultHandler, params, route)
}

export function pickRoute(pathname, routeMap) {
  if (!routeMap.hasOwnProperty(routeMapSymbol))
  throw new Error('Please normalize your routeMap using the `asRouteMap` function')

  const pathSegments = pathname.split('/').filter(Boolean)
  return pickFromChildren(pathSegments, routeMap[routeMapSymbol].children)
}

export function asRouteChain(route) {
  if (!route) return []
  return asRouteChain(route[routeSymbol].parent).concat(route)
}

function interpolate(routePath, params) {
  return routePath
    .replace(/:([^/]+)/g, (_, paramName) => {
      const newValue = params[paramName]
      if (!newValue) throw new Error(`Could not find value for '${paramName}'`)
      return newValue
    })
    .replace(/(\*)/, () => params['*'] || '')
}

function byScore(a, b) { return b.score - a.score }

function pickFromChildren(pathSegments, children, allParams = {}) {
  const preparedChildren = []
  for (const route of children) {
    const pathInfo = route[routeSymbol].getPathInfo(allParams)
    if (!pathInfo) continue
    const { pathSegments, score } = pathInfo
    preparedChildren.push({ route, routeSegments: pathSegments, score })
  }
  preparedChildren.sort(byScore)

  for (const { route, routeSegments } of preparedChildren) {
    const nonEmptyRouteSegments = routeSegments.filter(Boolean)

    const info = matchRouteSegments(nonEmptyRouteSegments, pathSegments)
    if (!info) continue

    const { params, remainingSegments } = info
    const children = route[routeSymbol].children
    const hasChildren = Boolean(children.length)
    const hasRemainingSegments = Boolean(remainingSegments.length)

    const potentialMatch = hasChildren || !hasRemainingSegments
    if (!potentialMatch) continue

    Object.assign(allParams, params)

    const resultFromChildren = pickFromChildren(remainingSegments, children, allParams)
    if (resultFromChildren) return resultFromChildren

    if (!hasRemainingSegments) return { params: allParams, route }
  }

  return null
}

function matchRouteSegments(routeSegments, pathSegments) {
  const params = {}
  let remainingSegments = pathSegments

  for (const routeSegment of routeSegments) {
    const matchParams = matchRouteSegment(routeSegment, remainingSegments)
    if (!matchParams) return

    Object.assign(params, matchParams)
    remainingSegments = '*' in matchParams ? [] : remainingSegments.slice(1)
  }

  return { params, remainingSegments }
}

function matchRouteSegment(routeSegment, segments) {
  const [segment] = segments
  if (!segment)
    return

  if (routeSegment.startsWith(':'))
    return { [routeSegment.slice(1)]: segment }

  if (routeSegment === '*')
    return { '*': segments.join('/') }

  if (segment === routeSegment)
    return emptyObject
}

function score(routeSegments) {
  return routeSegments.reduce(
    (previousScore, segment, i) => {
      const score =
        segment === '*' ? -2 :
        segment.startsWith(':') ? 4 :
        8

      return previousScore + (score / (i + 1))
    },
    0
  )
}

function normalizeChildren(config, children, getParent = () => null, parentName = '') {
  return mapValues(children, (childOrPath, key) => {
    const route = typeof childOrPath === 'string' ? { path: childOrPath } : childOrPath
    return normalize(config, route, getParent, parentName ? `${parentName}.${key}` : key)
  })
}

function normalize(config, routeInput, getParent, name) {
  const { path, data = undefined, ...children } = routeInput
  if (path === undefined) throw new Error(`No path found in ${JSON.stringify(routeInput)}`)

  const normalizedChildren = normalizeChildren(config, children, () => route, name)
  const route = createRoute(config, name, path, data, normalizedChildren, getParent)
  return route
}

function getObjectPathInfo(localizedPaths) {
  return mapValues(localizedPaths, getStringPathInfo)
}

function getStringPathInfo(path) {
  const pathSegments = path.split('/')
  return { pathSegments, score: score(pathSegments) }
}

function createRoute(config, name, path, data, children, getParent) {
  const { languageParamName = 'language' } = config
  const pathIsString = typeof path === 'string'
  const pathInfo = pathIsString ? getStringPathInfo(path) : getObjectPathInfo(path)
  return withReverseRoute(config, {
    ...children,
    toString() { return name },
    path,
    data,
    [routeSymbol]: {
      get parent() { return getParent() },
      children: Object.values(children),
      name,
      getPathInfo(params) {
        if (pathIsString) return pathInfo
        const language = params[languageParamName]
        return pathInfo[language]
      }
    },
  })
}

function withReverseRoute(config, route) {
  const { trailingSlash = false, languageParamName = 'language' } = config
  return Object.assign(reverseRoute, route)

  function reverseRoute(params = {}) {
    const parentPaths = getParents(route).map(x => x.path)

    const resolvedPath = [...parentPaths, route.path].reduce(
      (base, path) => {
        const { [languageParamName]: language } = params
        const normalizedPath = normalizePath(path, language)
        if (normalizedPath === null) throwError(`Could not determine path from ${JSON.stringify(path)} with language ${language}`)
        return resolve(normalizedPath, base, params)
      },
      ''
    )

    return `${resolvedPath}${trailingSlash && !resolvedPath.endsWith('/') ? '/' : ''}`
  }
}

function normalizePath(path, language) {
  return (
    typeof path === 'string' ? path :
    language in path ? path[language] :
    null
  )
}

function resolve(path, base, params) {
  const pathValue = interpolate(path, params)
  return `${base}/${pathValue}`
}

function getParents({ [routeSymbol]: { parent } }) {
  return !parent ? [] : getParents(parent).concat(parent)
}
