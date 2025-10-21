/**
 * @import { MessageBroker } from './machinery/messageBroker.js'
 * @import { routeMap } from './routeMap.js'
 * @import { ProvideParamsToRouteMap } from './machinery/routeMapTypes.ts'
 * @import { DocumentSchema, DocumentSchemas, FieldTypes } from './cmsConfigTypes.ts'
 * @import { DocumentPath } from '#cms/types.ts'
 */


/**
 * @typedef {{
 *   documentSchemas: DocumentSchemas
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

/** @arg {string} schemaType */
export function getSchema(schemaType) {
  return context.documentSchemas.find(x => x.type === schemaType)
}

/** @arg {DocumentSchema.DocumentSchema} schema @arg {DocumentPath} fieldPath */
export function getPathInfo(schema, fieldPath) {
  const segments = fieldPath.split('/').filter(Boolean)

  /** @typedef {{ title: string, fields: Array<{ name: string} & (ObjectConfig | ArrayConfig)> }} ObjectConfig */
  /** @typedef {{ title: string, of: Array<ObjectConfig> }} ArrayConfig */

  let previous = /** @type {ObjectConfig | ArrayConfig} */ (schema)
  let result = []
  for (const key of segments) {
    const index = Number(key)
    const inArray = !isNaN(index)
    const field = isArrayConfig(previous, inArray)
      ? previous.of[0] // TODO: how to determine the type? The `of` can have multiple types - we need to encode the field type in the field path
      : previous.fields.find(x => x.name === key)

    previous = field
    result.push({ inArray, key: inArray ? index : key, field })
  }

  return result

  /** @arg {ObjectConfig | ArrayConfig} value @arg {boolean} inArray @returns {value is ArrayConfig} */
  function isArrayConfig(value, inArray) {
    return inArray
  }
}
