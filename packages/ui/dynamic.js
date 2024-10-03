import { Signal } from './signal.js';

const onDestroyCallbacks = []

export function useOnDestroy(callback) {
  const target = onDestroyCallbacks[onDestroyCallbacks.length - 1]
  if (!target) throw new Error(`useOnDestroy called while not capturing. If this is the result of a signal subscription, use the dynamic helper methods from.`)
  target.push(callback)
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

/** @template T */
export class Loop {
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
