import { pane } from '#cms/client/cmsConfig.js'
import { context, getSchema } from '#cms/client/context.js'
import { useDocuments } from '#cms/client/data.js'
import { pushState } from '#cms/client/machinery/history.js'
import { ButtonAdd } from '#cms/client/ui/Button.js'
import { FlexSectionHorizontal, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { ListSignal } from '#cms/client/ui/List.js'
import { useCombined } from '#ui/hooks.js'
import { createSignal, Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { ListItem } from './list/ListItem.js'
/** @import { DeskStructure, DocumentSchema } from '../../cmsConfigTypes.ts' */
/** @import { FormEvent } from 'react' */
/** @import { Document, PanePath } from '#cms/types.ts' */

const { input } = tags

/**
 * @typedef {{
 *   schemaType: string,
 * }} DocumentListPaneConfig
 */

/** @type {DeskStructure.PaneResolver<DocumentListPaneConfig>} */
export function resolveDocumentListPane({ config, context }) {
  const child = pane('document', { id: context.nextPathSegment, schemaType: config.schemaType })
  return { child }
}

/** @type {DeskStructure.PaneRenderer<DocumentListPaneConfig>} */
export function renderDocumentListPane({ pane, path }) {
  return DocumentListPane({ schemaType: pane.schemaType, path })
}

DocumentListPane.style = css`
  max-width: 20rem;

  & > :last-child {
    flex-grow: 1;
  }
`
/** @arg {{ schemaType: string, path: PanePath }} props */
export function DocumentListPane({ schemaType, path }) {
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  const { $documents, setFilter } = useFilteredDocuments({ schema })

  return (
    FlexSectionVertical({ className: 'DocumentListPane', css: DocumentListPane.style },
      DocumentListHeader({ schema, onFilterChange: handleFilterChange, onAddClick: handleAddClick }),
      DocumentListItems({ $documents, schema, path })
    )
  )

  function handleAddClick() {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    pushState(null, undefined, newPath)
  }

  /** @arg {string} value */
  function handleFilterChange(value) {
    setFilter(value)
  }
}

DocumentListHeader.style = css`
  align-items: center;

  & > input {
    flex-grow: 1;
  }
`
/**
 * @arg {{
 *   schema: DocumentSchema.DocumentSchema,
 *   onFilterChange: (value: string) => void,
 *   onAddClick: () => void,
 * }} props
 */
function DocumentListHeader({ schema, onFilterChange, onAddClick }) {
  return (
    FlexSectionHorizontal({ className: 'DocumentListHeader', css: DocumentListHeader.style },
      input({ type: 'text', onInput: handleInput }),
      ButtonAdd({ title: `Add ${schema.title}`, onClick: onAddClick }),
    )
  )

  /** @arg {FormEvent<HTMLInputElement>} e */
  function handleInput(e) {
    onFilterChange(e.currentTarget.value)
  }
}
/**
 * @arg {{
 *  $documents: Signal<Array<Document>>,
 *  schema: DocumentSchema.DocumentSchema,
 *  path: PanePath,
 * }} props
 */
function DocumentListItems({ $documents, schema, path }) {
  return (
    ListSignal({
      signal: $documents,
      getKey: document => document._id,
      renderItem: ($document, key) => {
        return (
          ListItem({
            href: [context.basePath, ...path, key].join('/'),
            title: $document.derive(document => schema.preview(document).title),
          })
        )
      }
    })
  )
}

/** @arg {{ schema: DocumentSchema.DocumentSchema }} props */
function useFilteredDocuments({ schema }) {
  const $documents = useDocuments({ schemaType: schema.type })
  const [$filter, setFilter] = createSignal('')
  const $filteredDocuments = useCombined($documents, $filter)
    .derive(([documents, filter]) => documents.filter(doc =>
      schema.preview(doc).title.toLowerCase().includes(filter.toLowerCase()))
    )

  return { $documents: $filteredDocuments, setFilter }
}
