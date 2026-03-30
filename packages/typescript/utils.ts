export type DeepReadonly<T> =
  T extends Function ? T :
  T extends { [K in keyof T]: any } ? { [K in keyof T]: DeepReadonly<T[K]> } :
  T

// https://github.com/microsoft/TypeScript/issues/30680
export type Narrowable = string | number | boolean | symbol | object | undefined/* | void | null | {} */
export type Const<N> =
  N | { [K in keyof N]: N[K] extends Narrowable ? N[K] | Const<N[K]> : never }

export type Expand<T> =
  T extends ((...args: infer A) => infer R) ? ((...args: A) => R) & ExpandObject<T> :
  ExpandObject<T>

type ExpandObject<T> =
  T extends infer O ? { [K in keyof O]: Expand<O[K]> } :
  never

export type ArrayToUnion<T extends Array<any>> =
  T extends [infer Head, ...infer Tail] ? Head | ArrayToUnion<Tail> :
  never

export type RemoveIntersection<T, ToRemove> =
  T extends (ToRemove & infer X) ? X : never

export type TupleOf<Count extends number, Offset extends number = 0, T extends any[] = []> =
  T['length'] extends Count ? T : TupleOf<Count, Offset, [...T, Add<T['length'], Offset>]>;

export type Subtract<A extends number, B extends number> =
  TupleOf<A> extends [...TupleOf<B>, ...infer Rest] ? Rest['length'] : never

export type Add<A extends number, B extends number> =
  [...TupleOf<A>, ...TupleOf<B>] extends [...infer Rest] ? Rest['length'] : never

export type UnionOf<N extends number, O extends number = 0> = ArrayToUnion<TupleOf<N, O>>
