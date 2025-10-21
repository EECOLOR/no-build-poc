import { Signal } from '#ui/signal.js'
import { DocumentSchema } from './client/cmsConfigTypes.ts'

export type Document = { _id: string, _type: string } & { [key: string]: any }

export type DocumentContainer = {
  id: string,
  schema: DocumentSchema.DocumentSchema,
  $value: Signal<Document>,
}

export type Image = {
  filename: string
  metadata: ImageMetadata
}

export type ImageMetadata = {
  width: number
  height: number
  originalFilename: string
  crop?: ImageCrop
  hotspot?: ImageHotspot
}

export type Rectangle = {
  x:number
  y: number
  width: number
  height: number
}

export type ImageCrop = Rectangle

export type ImageHotspot = Rectangle

export type AuthInfo = AuthenticatedInfo | UnauthenticatedInfo

export type AuthenticatedInfo = { authenticated: true, idProvider: string, user: User }
export type UnauthenticatedInfo = { authenticated: false, hint: string }
export type User = { email: string, name: string, id: string }

export type DocumentPath = string
export type PanePath = Array<string>

export type RichTextSteps = {
  version: number,
  steps: Array<any>,
  clientIds: Array<string>,
}

export type HistoryItem = {
  documentId: string,
  fieldPath: string,
  userId: string,
  timestampStart: number,
  timestampEnd: number,
  details: HistoryDetails,
  key: string,
}

export type HistoryDetails = {
  fieldType: string,
  valueForDiff: any,
  patches?: Array<Patch>,
}

export type Patch =
 { op: 'replace', path: string, value: any, valueForDiff: any } |
 { op: 'move', from: string, path: string } |
 { op: 'remove', path: string }
