import { Signal } from './signal.js'

// This type can not be expressed in JSDoc
export type TypeOrArrayOfType<T> = T | Array<TypeOrArrayOfType<T>>

// [Signal<X>, Signal<Y>] => Signal<[X, Y]>
export type CombineSignals<T extends Array<Signal<any>>> = Signal<ExtractSignalTypes<T>>

export type ExtractSignalTypes<T extends Array<Signal<any>>> =
  T extends [Signal<infer Head>, ...infer Tail]
    ? Tail extends Array<Signal<any>>
      ? [Head, ...ExtractSignalTypes<Tail>]
      : [Head]
    : []

