import type { routeSymbol, routeMapSymbol } from './routeMap'

export type RouteMap = { [route: string]: Route, [routeMapSymbol]: { children: RouteChildren } }
export type Route = ReverseRoute & ((RouteChildren & RouteProps) | RouteProps)
export type ReverseRoute = (params?: object) => string
export type RouteChildren = { [child: string]: Route }
export type RouteProps = {
  data?: any,
  path: Path,
  [routeSymbol]: { parent: Route, name: string, children: RouteChildren },
  toString(): string,
}
type Path = string | { [language: string]: string }

export type HandlerOf<A> =
  A extends (...args: any) => infer B ? ((params?: object, route?: Route) => B) :
  never
export type ReturnTypesOf<A> =
  A extends [[Route, infer B], ...infer C] ? ReturnTypeOf<B> | ReturnTypesOf<C> :
  never
export type ReturnTypeOf<A> = A extends (...args: any) => any ? ReturnType<A> : A

// https://github.com/microsoft/TypeScript/issues/30680
export type Narrowable = string | number | boolean | symbol | object | undefined | void | null | {}

export type RouteMapInput = { [name: string]: RouteInput }
type RouteInput = string | (RouteInputChildren & RouteInputObject) | RouteInputObject
type RouteInputObject = { path: Path, data?: any }
type RouteInputChildren = { [K in Exclude<keyof RouteInputObject, string>]: RouteInput }

export type AsRouteMap<A> =
  { [K in keyof A]: AsRoute<A[K], {}> } &
  { [routeMapSymbol]: { children: { [K in keyof A]: AsRoute<A[K], {}> } } }
type AsRoute<A, Params> = ((params?: Params & AsParams<A>) => string) & (
  A extends string ? AsRouteProps<{ path: A, data: undefined }> :
  A extends (RouteInputChildren & RouteInputObject) ? AsRouteChildren<Omit<A, keyof RouteInputObject>, Params & AsParams<A>> & AsRouteProps<A> :
  A extends RouteInputObject ? AsRouteProps<A> :
  never
)
type AsRouteChildren<A, Params> = { [K in keyof A]: AsRoute<A[K], Params> }
type AsRouteProps<A extends RouteInputObject> = {
  path: A['path'],
  data: A['data'],
  [routeSymbol]: { parent: Route, name: string, children: RouteChildren },
  toString(): string,
}
type AsParams<A> = LanguageSupport & (
  A extends string ? { [K in StringAsParams<A>]: string } :
  A extends RouteInputObject ? { [K in StringAsParams<A['path']>]: string } :
  never
)
type StringAsParams<A> =
  A extends { [language: string]: infer B } ? StringAsParams<B> :
  A extends `:${infer B}/${infer C}` ? B | StringAsParams<C> :
  A extends `:${infer B}` ? B :
  A extends `${infer B}/${infer C}` ? StringAsParams<C> :
  A extends `*` ? '*' :
  never
type LanguageSupport = { language?: string }

export type Config = {
  trailingSlash?: boolean
  languageParamName?: string
}
