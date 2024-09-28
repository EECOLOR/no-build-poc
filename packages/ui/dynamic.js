import { Signal } from './signal.js';

const onDestroyCallbacks = [[]]

export function useOnDestroy(callback) {
  onDestroyCallbacks[onDestroyCallbacks.length - 1].push(callback)
}

export function withOnDestroyCapture(f) {
  onDestroyCallbacks.push([])
  const result = f()
  return [result, onDestroyCallbacks.pop()]
}

/**
 * @template T
 * @typedef {T extends Signal<infer X> ? Extract<X> : T extends Array<infer X> ? X : never} Extract
 */

/** @template {Signal<Array<any>>} T */
export class Loop {
  /**
   * @param {T} signal
   * @param {(value: Extract<T>, index: number) => any} getKey
   * @param {(value: Extract<T>, index: number, items: Array<Extract<T>>) => any} renderItem
   */
  constructor(signal, getKey, renderItem) {
    this.signal = signal
    this.getKey = getKey
    this.renderItem = renderItem
  }
}

/**
 * @template {Signal<Array<any>>} T
 * @param {T} signal
 * @param {(value: Extract<T>) => any} getKey
 * @param {(value: Extract<T>) => any} renderItem
 */
export function loop(signal, getKey, renderItem) {
  return new Loop(signal, getKey, renderItem)
}

/** @template T */
export class Conditional {
  /**
   * @param {Signal<T>} signal
   * @param {(value: T) => boolean} predicate
   * @param {(value: T) => any} renderItem
   */
  constructor(signal, predicate, renderItem) {
    this.signal = signal
    this.predicate = predicate
    this.renderItem = renderItem
  }
}

export function conditional(signal, predicate, renderItem) {
  return new Conditional(signal, predicate, renderItem)
}
