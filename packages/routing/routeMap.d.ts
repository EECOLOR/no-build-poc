import type { Route, RouteMap, Narrowable, AsRouteMap, HandlerOf, ReturnTypeOf, ReturnTypesOf, Config } from './types'

export function asRouteMap<
  N extends Narrowable,
  T extends { [k: string]: N | T | [] }// & RouteMapInput
>(input: T, config?: Config): AsRouteMap<T>

export function pick<
  A,
  X extends Narrowable,
  B extends Array<[Route, ((p: object, r: Route) => X) | X]>
>(
  pathname: string,
  [routeMap, defaultHandler]: [RouteMap, HandlerOf<A> | A],
  ...overrides: B
): ReturnTypeOf<A> | ReturnTypesOf<B>

export function pickRoute(pathname: string, routeMap: RouteMap): { params: object, route: Route } | null

export function asRouteChain(route: Route): Array<Route>

export const routeSymbol: unique symbol
export const routeMapSymbol: unique symbol
