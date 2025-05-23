/**
 * @import { MessageBroker } from './machinery/messageBroker.js'
 * @import { routeMap } from './routeMap.js'
 * @import { ProvideParamsToRouteMap } from './machinery/routeMapTypes.ts'
 * @import { FieldTypes } from './cmsConfigTypes.ts'
 */


/**
 * @typedef {{
 *   documentSchemas: any
 *   fieldTypes: FieldTypes
 *   documentView: any
 *   basePath: any
 *   userId: string
 *   clientId: string
 *   api: ProvideParamsToRouteMap<typeof routeMap, { version: string }>['api']['versioned']
 *   events: MessageBroker
 *   handleError(e: Error): void
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

export function getPathInfo(schema, fieldPath) {
  const segments = fieldPath.split('/').filter(Boolean)

  let previous = schema
  let result = []
  for (const key of segments) {
    const index = Number(key)
    const inArray = !isNaN(index)
    const field = inArray
      ? previous.of[0] // TODO: how to determine the type? The `of` can have multiple types
      : previous.fields.find(x => x.name === key)
    previous = field
    result.push({ inArray, key: inArray ? index : key, field })
  }

  return result
}
