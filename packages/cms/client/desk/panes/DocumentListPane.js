import { ButtonAdd, ListSignal } from '#cms/client/buildingBlocks.js'
import { context, getSchema } from '#cms/client/context.js'
import { useDocuments } from '#cms/client/data.js'
import { pushState } from '#cms/client/machinery/history.js'
import { useCombined } from '#ui/hooks.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { ListItem } from './list/ListItem.js'

const { div, input } = tags

DocumentListPane.style = css`& {
  display: flex;
  flex-direction: column;
  max-width: 20rem;
  gap: var(--default-gap);

  & > :last-child {
    flex-grow: 1;
  }
}`
export function DocumentListPane({ schemaType, path }) {
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  const { $documents, setFilter } = useFilteredDocuments({ schema })

  return (
    div({ className: 'DocumentListPane' },
      DocumentListPane.style,
      DocumentListHeader({ schema, onFilterChange: handleFilterChange, onAddClick: handleAddClick }),
      DocumentListItems({ $documents, schema, path })
    )
  )

  function handleAddClick() {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    pushState(null, undefined, newPath)
  }

  function handleFilterChange(value) {
    setFilter(value)
  }
}

DocumentListHeader.style = css`& {
  display: flex;
  gap: var(--default-gap);

  & > input {
    flex-grow: 1;
  }
}`
function DocumentListHeader({ schema, onFilterChange, onAddClick }) {
  return (
    div(
      DocumentListHeader.style,
      input({ type: 'text', onInput: e => onFilterChange(e.currentTarget.value) }),
      ButtonAdd({ title: `Add ${schema.title}`, onClick: onAddClick }),
    )
  )
}

function DocumentListItems({ $documents, schema, path }) {
  return (
    ListSignal({
      signal: $documents,
      getKey: document => document._id,
      renderItem: ({ _id }) => {
        const $document = $documents.derive(documents => documents.find(x => x._id === _id))
        return (
          ListItem({
            href: [context.basePath, ...path, _id].join('/'),
            title: $document.derive(document => schema.preview(document).title),
          })
        )
      }
    })
  )
}

function useFilteredDocuments({ schema }) {
  const $documents = useDocuments({ schemaType: schema.type })
  const [$filter, setFilter] = createSignal('')
  const $filteredDocuments = useCombined($documents, $filter)
    .derive(([documents, filter]) => documents.filter(doc =>
      schema.preview(doc).title.toLowerCase().includes(filter.toLowerCase()))
    )

  return { $documents: $filteredDocuments, setFilter }
}
