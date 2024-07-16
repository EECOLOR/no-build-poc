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

/** @type {import('./routeMap').asRouteMap} */
export function asRouteMap(map, config = {}) {
  const children = normalizeChildren(config, map)
  return {
    ...children,
    [routeMapSymbol]: { children }
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
  const children = Object.values(routeMap[routeMapSymbol].children)
  const result = pickFromChildren(pathSegments, children)
  return result ? result : null
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

function pickFromChildren(pathSegments, children, previousParams = {}) {
  const preparedChildren = children
    .map(route => {
      const { languageParamName = 'language' } = route[routeSymbol].config
      const path = normalizePath(route.path, previousParams[languageParamName])
      if (path === null) return null

      return { route, routeSegments: path.split('/') }
    })
    .filter(Boolean)
    .sort((a, b) => score(b.routeSegments) - score(a.routeSegments))

  for (const { route, routeSegments } of preparedChildren) {
    const nonEmptyRouteSegments = routeSegments.filter(Boolean)

    const info = matchRouteSegments(nonEmptyRouteSegments, pathSegments)
    if (!info) continue

    const { params, remainingSegments } = info
    const children = Object.values(route[routeSymbol].children)
    const hasChildren = Boolean(children.length)
    const hasRemainingSegments = Boolean(remainingSegments.length)

    const potentialMatch = hasChildren || !hasRemainingSegments
    if (!potentialMatch) continue

    const resultFromChildren = pickFromChildren(remainingSegments, children, { ...previousParams, ...params }) // TODO add a test for adding 'previousParams' here
    if (resultFromChildren) return resultFromChildren

    if (!hasRemainingSegments) return { params: { ...previousParams, ...params }, route }
  }
}

function matchRouteSegments(routeSegments, pathSegments) {
  return routeSegments.reduce(
    (result, routeSegment) => {
      if (!result) return

      const { params: previousParams, remainingSegments: segments } = result
      const match = matchRouteSegment(routeSegment, segments)
      if (!match) return

      const { params, remainingSegments } = match
      return { params: { ...previousParams, ...params }, remainingSegments }
    },
    { params: {}, remainingSegments: pathSegments }
  )
}

function matchRouteSegment(routeSegment, remainingSegments) {
  const [segment, ...newRemainingSegments] = remainingSegments

  const paramMatch = routeSegment.startsWith(':') && segment
  const wildcardMatch = routeSegment === '*' && segment
  const staticMatch = segment === routeSegment

  return (wildcardMatch || paramMatch || staticMatch) && {
    params:
      paramMatch ? { [routeSegment.slice(1)]: segment } :
      wildcardMatch ? { '*': remainingSegments.join('/') } :
      staticMatch ? {} :
      throwError('Unexpected condition')
    ,
    remainingSegments: wildcardMatch ? [] : newRemainingSegments,
  }
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

function createRoute(config, name, path, data, children, getParent) {
  return withReverseRoute(config, {
    ...children,
    toString() { return name },
    path,
    data,
    [routeSymbol]: {
      get parent() { return getParent() },
      children,
      name,
      config,
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
