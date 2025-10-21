import { Signal } from '#ui/signal.js'
import { context } from './context.js'
import { useEventSourceAsSignal } from './machinery/useEventSourceAsSignal.js'
/** @import { Document, DocumentContainer, Image, ImageMetadata, Patch } from '#cms/types.ts' */

export const connecting = Symbol('connecting')

/**
 * @template T
 * @arg {T | typeof connecting} data
 * @return {data is T}
 */
export function isNotConnecting(data) {
  return data !== connecting
}

/** @arg {{ id: string, schemaType: string }} props */
export function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    channel: 'document',
    args: [schemaType, id],
    events: ['document'],
    type: /** @type {Document} */ (null),
    initialValue: /** @type {typeof connecting} */ (connecting),
  }).derive(x => typeof x === 'symbol' ? x : x?.data)
}

/** @arg {{ schemaType: string }} props */
export function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    channel: 'documents',
    args: [schemaType],
    events: ['documents'],
    type: /** @type {Array<Document>} */ (null),
    initialValue: /** @type {null} */ (null),
  }).derive(x => x?.data || [])
}

export function useImages() {
  return useEventSourceAsSignal({
    channel: 'images',
    args: [],
    type: /** @type {Array<Image>} */ (null),
    initialValue: /** @type {null} */ (null),
    events: ['images'],
  }).derive(x => x?.data || [])
}

/**
 * @arg {{ filename: string }} props
 */
export function useImageMetadata({ filename }) {
  return useEventSourceAsSignal({
    channel: 'image/metadata',
    args: [filename],
    events: ['metadata'],
    type: /** @type {ImageMetadata} */ (null),
    initialValue: /** @type {typeof connecting} */ (connecting),
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}

/** @arg {{ document: DocumentContainer, fieldType: string } & Patch} params */
export function patchDocument(params) {
 const { document, fieldType, op, path } = params
 const { value, valueForDiff } = op === 'replace' ? params : {}
 const { from } = op === 'move' ? params : {}

 // TODO: add retries if the versions do not match
 fetch(context.api.documents.single({ type: document.schema.type, id: document.id }), {
   method: 'PATCH',
   headers: {
     'Content-Type': 'application/json',
   },
   body: JSON.stringify({
     version: document.$value.get()?.version ?? 0,
     patch: { op, path, value, from },
     userId: context.userId,
     fieldType,
     valueForDiff,
   })
 }).catch(context.handleError)
}
