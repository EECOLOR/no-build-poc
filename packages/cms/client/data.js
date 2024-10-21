import { Signal } from '#ui/signal.js'
import { context } from './context.js'
import { useEventSourceAsSignal } from './machinery/useEventSourceAsSignal.js'

export const connecting = Symbol('connecting')

export function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}/${id}`,
    events: ['document'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}

export function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}`,
    events: ['documents'],
  }).derive(x => x?.data || [])
}

export function useImages() {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/images`,
    events: ['images'],
  }).derive(x => x?.data || [])
}

/** @returns {Signal<typeof connecting | { width, height, crop?, hotspot? }>} */
export function useImageMetadata({ filename }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/images/${filename}/metadata`,
    events: ['metadata'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}
