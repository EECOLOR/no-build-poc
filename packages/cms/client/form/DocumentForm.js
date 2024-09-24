import { tags } from '#ui/tags.js'
import { context, getSchema } from '../context.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { RichTextEditor } from './richTextEditor/RichTextEditor.js'

const { div, h1, label, span, input } = tags

export function DocumentForm({ id, $document, schemaType }) {
  const schema = getSchema(schemaType)

  return (
    div(// TODO: use context.documentView
      DocumentTitle({ $document, schema }),
      DocumentFields({ $document, id, schema }),
    )
  )
}

function DocumentTitle({ $document, schema }) {
  return h1($document.derive(document => schema.preview(document).title))
}

function DocumentFields({ $document, id, schema }) {
  return (
    div(
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          gridColumnGap: '1em',
        }
      },
      schema.fields.map(field => DocumentField({ $document, id, schema, field }))
    )
  )
}

const fieldRenderers = /** @type {const} */({
  'string': StringField,
  'rich-text': RichTextField,
})

function DocumentField({ $document, id, schema, field }) {
  const renderer = fieldRenderers[field.type]
  if (!renderer)
    return `Unknown field type '${field.type}'`

  return (
    label(
      {
        style: {
          gridColumn: 'span 2',

          display: 'grid',
          grid: 'inherit',
          gridTemplateColumns: 'subgrid',
          gridGap: 'inherit',
        }
      },
      span(field.title),
      renderer({ $document, id, schema, field })
    )
  )
}

function StringField({ $document, id, schema, field }) {
  const [$value, setValue] = useFieldValue({ $document, id, schema, field })

  return input({ type: 'text', value: $value, onInput: handleInput })

  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}

function RichTextField({ $document, id, schema, field }) {
  const richTextPathname = getRichTextPathname({ documentId: id, schemaType: schema.type, fieldPath: field.name })

  const $events = useEventSourceAsSignal({
    pathname: richTextPathname,
    events: ['initialValue', 'steps'],
  })
  const $initialValue = $events.derive((value, previous) =>
    value?.event === 'initialValue'
      ? { value: RichTextEditor.fromJson(value.data.value), version: value.data.version }
      : previous
  )
  const $steps = $events.derive((value, previous) =>
    value?.event === 'steps' ? { steps: value.data.steps.map(RichTextEditor.stepFromJson), clientIds: value.data.clientIds } :
    previous ? previous :
    { steps: [], clientIds: [] }
  )

  // This might be an interesting performance optimization if that is needed:
  // https://discuss.prosemirror.net/t/current-state-of-the-art-on-syncing-data-to-backend/5175/4
  return renderOnValue($initialValue,
    initialValue => RichTextEditor({ initialValue, $steps, synchronize }),
  )

  function synchronize({ clientId, steps, version, value }) {
    const controller = new AbortController()
    const result = fetch(
      richTextPathname,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          clientId,
          steps: steps.map(RichTextEditor.stepToJson),
          version,
          value: RichTextEditor.toJson(value),
        })
      }
    ).then(x => x.json())

    return {
      result,
      abort(reason) {
        controller.abort(reason)
      }
    }
  }
}


function getRichTextPathname({ schemaType, documentId, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return `${context.apiPath}/documents/${schemaType}/${documentId}/rich-text?fieldPath=${fieldPath}`
}

function useFieldValue({
  $document, id, schema, field,
  isEqual = (localValue, valueFromDocument) => localValue === valueFromDocument,
  serialize = x => x,
  deserialize = x => x,
}) {
  const $valueFromDocument = $document.derive(document => deserialize(document?.[field.name]) || '')
  let localValue = $valueFromDocument.get()
  let dirty = false

  // This signal only updates when it has seen the current local value
  const $value = $valueFromDocument.derive((valueFromDocument, oldValueFromDocument) => {
    if (isEqual(localValue, valueFromDocument)) dirty = false
    return dirty ? oldValueFromDocument : valueFromDocument
  })

  return [$value, setValue]

  function setValue(newValue) {
    dirty = true
    localValue = newValue

    fetch(`${context.apiPath}/documents/${schema.type}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: field.name,
        value: serialize(newValue),
        clientId: context.clientId,
      })
    }) // TODO: error reporting
  }
}
