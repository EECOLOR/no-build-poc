/** @import {Ref} from '#ui/hooks.js' */
import { useRef } from '#ui/hooks.js';

/**
 * @template {{ [method: string]: () => void }} T
 * @template {HTMLElement} S
 * @typedef {T & { ref: Ref<S> }} Controller
 */


/**
 * @template {HTMLElement} S
 * @template {{ [method: string]: () => void }} T
 * @arg {(ref: Ref<S>) => Controller<T, S>} createController
 * @returns {Controller<T, S>}
 */
export function useController(createController) {
  const ref = useRef()
  return createController(/** @type {any} */ (ref))
}

/**
 * @template {keyof HTMLElementTagNameMap} S
 * @template {{ [method: string]: () => void }} T
 * @arg {S} hint
 * @arg {(ref: Ref<HTMLElementTagNameMap[S]>) => T} f
 */
export function controller(hint, f) {
  /**
   * @arg {Ref<HTMLElementTagNameMap[S]>} ref
   * @returns {Controller<ReturnType<typeof f>, HTMLElementTagNameMap[S]>}
   */
  return ref => ({ ...f(ref), ref })
}
