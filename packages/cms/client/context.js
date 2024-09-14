/**
 * @typedef {{
 *   documentSchemas: any
 *   documentView: any
 *   basePath: any
 * }} Context
 */

/** @type {Context} */
export let context

/** @param {Context} newContext */
export function setContext(newContext) {
  context = newContext
}
