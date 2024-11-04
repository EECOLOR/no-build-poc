// https://github.com/microsoft/TypeScript/issues/30680
export type Narrowable = string | number | boolean | symbol | object | undefined
export type Const<N> =
  N | { [K in keyof N]: N[K] extends Narrowable ? N[K] | Const<N[K]> : never }

export type Expand<T> =
  T extends ((...args: infer A) => infer R) ? ((...args: A) => R) & ExpandObject<T> :
  ExpandObject<T>

type ExpandObject<T> =
  keyof T extends never ? unknown :
  T extends infer O ? { [K in keyof O]: O[K] } :
  never
