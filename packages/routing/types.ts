import { Expand } from '#typescript/utils.js'
import type { routeSymbol, routeMapSymbol } from './index.js'

export type RouteMap = { [routeMapSymbol]: any }
export type Route = ReverseRoute & RouteProps & { [routeSymbol]: any }
export type ReverseRoute = (params?: object) => string
export type RouteProps = {
  data?: any,
  path: Path,
  toString(): string,
}

export type RouteInputChildren = { [K in Exclude<keyof RouteInputObject, string>]: RouteInput }
type RouteInput = string | RouteInputWithChildren
type RouteInputWithChildren = RouteInputChildren & RouteInputObject
type RouteInputObject = { path: Path, data?: any }
type Path = string | { [locale: string]: string }

type EmptyParams = {}

export type AsRouteMap<Input extends RouteInputChildren, LocaleParamName extends string = 'language'> =
  ReturnType<typeof asRouteMap<Input, LocaleParamName>>

export type Config = {
  trailingSlash?: boolean
  localeParamName?: string
}

export type ExtractLocaleParamName<T extends Config> =
  T['localeParamName'] extends infer X
    ? (string extends X ? 'language' : X)
    : never

// declaring the types inside a function to prevent passing arround LocaleParamName
function asRouteMap<Input extends RouteInputChildren, LocaleParamName extends string>() {

  type AsRouteMap<Input extends RouteInputChildren> =
    AsRouteChildren<Input, EmptyParams> &
    { [routeMapSymbol]: any }

  type AsRouteChildren<Input extends RouteInputChildren, PreviousParams> =
    { [K in keyof Input]: Expand<AsRoute<Input[K], PreviousParams & AsParams<Input[K]>>> }

  type AsRoute<Input, Params> =
    AsReverseRoute<Params> & (
      Input extends string ? AsRouteProps<{ path: Input, data: undefined }> :
      Input extends RouteInputWithChildren ? AsRouteWithChildren<Input, Params> :
      never
    )

  type AsReverseRoute<Params> =
    keyof Params extends never ? () => string :
    (params: Expand<Params>) => string

  type AsRouteWithChildren<Input extends RouteInputWithChildren, Params> =
    AsRouteProps<Input> &
    AsRouteChildren<Omit<Input, keyof RouteInputObject>, Params>

  type AsRouteProps<Input extends RouteInputObject> = {
    path: Input['path'],
    data: Input['data'],
    toString(): string,
    [routeSymbol]: any,
  }

  type AsParams<Input> = (
    Input extends string ? { [K in PathAsParamNames<Input>]: string } :
    Input extends RouteInputObject ? { [K in PathAsParamNames<Input['path']>]: string } :
    never
  )

  type PathAsParamNames<Input> =
    Input extends { [locale: string]: infer B } ? LocaleParamName | PathAsParamNames<B> :
    Input extends `:${infer B}/${infer C}` ? B | PathAsParamNames<C> :
    Input extends `:${infer B}` ? B :
    Input extends `${infer B}/${infer C}` ? PathAsParamNames<C> :
    Input extends `*` ? '*' :
    never

  return (null as Expand<AsRouteMap<Input>>)
}
