import { Expand } from '#typescript/utils.ts'

export type ProvideParamsToRouteMap<RouteMap, Params> = {
  [Key in keyof RouteMap]: RouteMap[Key] extends Func
      ? ProvideParamsToRoute<RouteMap[Key], Params>
      : RouteMap[Key]
}

type ProvideParamsToRoute<Route extends Func, Params> =
  ((params: Expand<Omit<Parameters<Route>[0], keyof Params>>) => string) & {
    [Key in keyof Route]: Route[Key] extends Func
      ? ProvideParamsToRoute<Route[Key], Params>
      : Route[Key]
  }

type Func = (...args: any[]) => any
