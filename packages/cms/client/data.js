import { Signal } from '#ui/signal.js'
import { context } from './context.js'
import { useEventSourceAsSignal } from './machinery/useEventSourceAsSignal.js'

export const connecting = Symbol('connecting')

export function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    channel: 'document',
    args: [schemaType, id],
    events: ['document'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}

export function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    channel: 'documents',
    args: [schemaType],
    events: ['documents'],
  }).derive(x => x?.data || [])
}

export function useImages() {
  return useEventSourceAsSignal({
    channel: 'images',
    args: [],
    events: ['images'],
  }).derive(x => x?.data || [])
}

/** @returns {Signal<typeof connecting | { width, height, crop?, hotspot? }>} */
export function useImageMetadata({ filename }) {
  return useEventSourceAsSignal({
    channel: 'image/metadata',
    args: [filename],
    events: ['metadata'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}

/**
 * @param {{ document, fieldType } & (
*   { op?: 'replace', path: string, value: any } |
*   { op: 'move', from: string, path: string } |
*   { op: 'remove', path: string }
* )} params
*/
export function patchDocument(params) {
 const { document, fieldType } = params
 const { op = 'replace', path, value, from } = /** @type {typeof params & { value?: any, from?: any }} */ (params)
 // TODO: add retries if the versions do not match
 fetch(`${context.apiPath}/documents/${document.schema.type}/${document.id}`, {
   method: 'PATCH',
   headers: {
     'Content-Type': 'application/json',
   },
   body: JSON.stringify({
     version: document.$value.get()?.version ?? 0,
     patch: { op, path, value, from },
     clientId: context.clientId,
     fieldType,
   })
 }).catch(context.handleError)
}
