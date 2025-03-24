import * as prosemirror from 'prosemirror-model'
import { builtInPaneTypes } from './desk/panes/builtInPaneTypes.js'

// TODO: Think about adding types for custom panes and fields in user/developer space,
// maybe an interface that is mixed in, maybe use the same technique as jsx. We now
// only use the types from builtInPaneTypes
export interface CmsConfig {
  deskStructure: DeskStructure
  paneTypes: PaneTypes
  documentSchemas: DocumentSchemas
  documentView: DocumentView
}

interface DeskStructure {
  pane: DeskStructure.Pane<DeskStructure.PaneTypes>
}

export type PaneTypes = {
  readonly [P in DeskStructure.PaneTypes]: {
    readonly type: P
    readonly Type: DeskStructure.PaneConfig<P>,
    readonly resolvePane?: DeskStructure.PaneResolver<DeskStructure.PaneConfig<P>>,
    readonly renderPane: DeskStructure.PaneRenderer<DeskStructure.PaneConfig<P>>,
  }
}

type DocumentSchemas = Array<DocumentSchema.DocumentSchema>

interface DocumentView {

}


export namespace DeskStructure {
  type MapValueToKey<O extends { [key: string]: { [P in K]: any } }, K extends string> =
    { [P in keyof O]: O[P][K] }

  type Panes = MapValueToKey<typeof builtInPaneTypes, 'Type'>

  export type PaneTypes = keyof Panes

  export type PaneConfig<T extends PaneTypes> = Panes[T]
  export type Pane<T extends PaneTypes> = { type: T } & PaneConfig<T>
  export type PaneTypeParams<T extends PaneTypes> = {} extends PaneConfig<T> ? [] : [PaneConfig<T>]

  export type PaneResolver<T> =
    (props: { config: T, context: { nextPathSegment: string } }) => { child?: Pane<PaneTypes> }

  export type PaneRenderer<T> =
    (props: { pane: T, path: Array<string> }) => any
}

export namespace DocumentSchema {
  interface Fields {
    string: {},

    object: {
      fields: Array<Field<FieldTypes>>,
      options?: {
        collapsible?: boolean,
        showObjectHeader?: boolean,
      },
    },

    image: {},

    'rich-text': {
      schema: prosemirror.Schema,
    },

    array: {
      of: Array<ArrayObject>,
    },

    reference: {
      title: string,
      to: Array<string>,
    }
  }

  export type DocumentSchema =
    { type: string, title?: string, fields: Array<Field<FieldTypes>>, preview(doc: any): { title: string } }

  export type FieldTypes = keyof Fields

  export type Field<T extends FieldTypes> =
    { name: string, type: T, title?: string } & FieldTypeProps<T>

  export type FieldTypeProps<T extends FieldTypes> =
    {} & Fields[T]

  export type ArrayObject =
    { type: string, title?: string } & Fields['object']
}

export type Simplify<T> =
  T extends (...args: any[]) => any ? T :
  T extends object ?
    (T extends infer O
      ? { [K in keyof O]: Simplify<O[K]> }
      : never
    ) :
  T

  export type DeepRequired<T> =

  T extends object ?
    (T extends infer O
        ? { [K in keyof O]-?: DeepRequired<O[K]> }
        : never
    )
  : T

export type AsReturnType<T> = Simplify<DeepRequired<T>>


export type RequiredParams<T> = Partial<T> extends T ? [] | [T] : [T]
