/**
 * @typedef {{
 *   documentSchemas: any
 *   documentView: any
 *   basePath: any
 *   clientId: string
 * }} Context
 */

/** @type {Context} */
export let context

/** @param {Context} newContext */
export function setContext(newContext) {
  context = newContext
}

export function getSchema(schemaType) {
  return context.documentSchemas.find(x => x.type === schemaType)
}
