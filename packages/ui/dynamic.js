import { Signal } from './signal.js';

/** @import { ExtractSignalType } from './types.ts' */

/** @typedef {() => void} Callback */

/** @type {Array<Array<Callback>>} */
const onDestroyCallbacks = []

/**
 * @arg {Callback} callback
 */
export function useOnDestroy(callback) {
  const target = onDestroyCallbacks[onDestroyCallbacks.length - 1]
  if (!target) throw new Error(`useOnDestroy called while not capturing. You most likely are rendering a signal from within another signal, instead of 'signal.derive' use 'derive' or any other method form '#ui/dynamic.js'.`)
  target.push(callback)
}

/**
 * @template X
 * @arg {() => X} f
 * @returns {[X, Array<Callback>]}
 */
export function withOnDestroyCapture(f) {
  onDestroyCallbacks.push([])
  const result = f()
  return [result, onDestroyCallbacks.pop()]
}

/** @template T @template K */
export class Dynamic {
  /**
   * @arg {Signal<Array<T>>} signal
   * @arg {(value: T) => K} getKey
   * @arg {($value: Signal<T>, key: K) => any} renderItem
   */
  constructor(signal, getKey, renderItem) {
    this.signal = signal
    this.getKey = getKey
    this.renderItem = renderItem
  }
}

/**
 * @template T
 * @arg {Signal<Array<T>>} signal
 * @arg {(value: T) => any} getKey
 * @arg {(value: Signal<T>, key: any) => any} renderItem
 */
export function loop(signal, getKey, renderItem) {
  return new Dynamic(signal, getKey, renderItem)
}

/**
 * @template {Signal<any>} S
 * @template {ExtractSignalType<S>} X
 * @arg {S} signal
 * @arg {(value: ExtractSignalType<S>) => value is X} predicate
 * @arg {($value: Signal<X>, key: boolean) => any} renderItem
 * @returns {Dynamic<X, boolean>}
 */
export function conditional(signal, predicate, renderItem) {
  return new Dynamic(signal.derive(x => predicate(x) ? [x] : []), predicate, renderItem)
}

/**
 * @template T
 * @template X
 * @arg {Signal<T>} signal
 * @arg {(value: T) => X} renderItem
 * @returns {Dynamic<T, T>}
 */
export function derive(signal, renderItem) {
  return new Dynamic(signal.derive(x => [x]), x => x, (_, key) => renderItem(key))
}
