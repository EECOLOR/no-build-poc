import { Signal } from './signal.js';

const onDestroyCallbacks = []

/**
 * @param {() => void} callback
 */
export function useOnDestroy(callback) {
  const target = onDestroyCallbacks[onDestroyCallbacks.length - 1]
  if (!target) throw new Error(`useOnDestroy called while not capturing. You most likely are rendering a signal from within another signal, instead of 'signal.derive' use 'derive' or any other method form '#ui/dynamic.js'.`)
  target.push(callback)
}

/**
 * @template X
 * @param {() => X} f
 * @returns {[X, Array<() => void>]}
 */
export function withOnDestroyCapture(f) {
  onDestroyCallbacks.push([])
  const result = f()
  return [result, onDestroyCallbacks.pop()]
}

/** @template T */
export class Dynamic {
  /**
   * @param {Signal<Array<T>>} signal
   * @param {(value: T, index: number, items: Array<T>) => any} getKey
   * @param {(value: T, index: number, items: Array<T>) => any} renderItem
   */
  constructor(signal, getKey, renderItem) {
    this.signal = signal
    this.getKey = getKey
    this.renderItem = renderItem
  }
}

/**
 * @template T
 * @param {Signal<Array<T>>} signal
 * @param {(value: T, index: number, items: Array<T>) => any} getKey
 * @param {(value: T, index: number, items: Array<T>) => any} renderItem
 */
export function loop(signal, getKey, renderItem) {
  return new Dynamic(signal, getKey, renderItem)
}

export function conditional(signal, predicate, renderItem) {
  return new Dynamic(signal.derive(x => predicate(x) ? [x] : []), predicate, renderItem)
}

export function derive(signal, renderItem) {
  return new Dynamic(signal.derive(x => [x]), x => x, renderItem)
}
